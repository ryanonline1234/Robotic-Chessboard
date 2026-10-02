/*
 * A pretend GRBL 1.1 controller for the tests. It speaks GRBL's text
 * protocol over a port object with write(text) and onData(callback), the
 * same shape src/grbl.js expects from a serial port, so the streamer can be
 * tested without hardware.
 *
 * Like GRBL it ends a line at '\r' or '\n' (and answers an empty line with
 * "ok"), acts on '?', '!' and Ctrl-X the moment they arrive, and sends its
 * output split into small chunks so lines arrive in pieces.
 *
 *   reply(line, fake)  what to answer each line with: a string such as 'ok'
 *                      or 'error:22', an array of strings, an object
 *                      { text, delayMs }, or null for no answer at all
 *   holdMs             after '!', how long the carriage takes to stop: it
 *                      reports Hold:1 until then, Hold:0 after (default 0)
 *   honoursHold        false makes '!' change nothing, as if the carriage
 *                      never reported that it stopped (default true)
 *
 * fake.log has every '?', '!', '~' and Ctrl-X with the time it arrived and
 * the state the fake was in then ({ c, at, head }); fake.holdDoneAt is when
 * the last hold finished.
 */
export function createFakeGrbl({
  reply = () => 'ok',
  delayMs = 1,
  state = 'Idle',
  answersStatus = true,
  bannerOnReset = true,
  holdMs = 0,
  honoursHold = true,
} = {}) {
  let listener = null;
  let partial = '';
  const fake = {
    received: [], // every complete line, in order
    writes: [], // every raw write() call
    realtime: [], // '?', '!', '~' and '\x18' as they arrived
    log: [], // the same, as { c, at, head }
    holdDoneAt: undefined,
    state,
    substate: undefined,
    inFlight: 0,
    maxInFlight: 0,
    port: {
      write(text) {
        fake.writes.push(text);
        for (const c of text) take(c);
      },
      onData(callback) {
        listener = callback;
        return () => {
          listener = null;
        };
      },
    },
    // Sends text from "GRBL" to the host, a few characters at a time.
    emit(text, after = delayMs) {
      setTimeout(() => {
        for (let i = 0; i < text.length; i += 3) listener?.(text.slice(i, i + 3));
      }, after);
    },
    boot({ locked = false, after = delayMs } = {}) {
      fake.emit(`\r\nGrbl 1.1h ['$' for help]\r\n${locked ? "[MSG:'$H'|'$X' to unlock]\r\n" : ''}`, after);
      if (locked) fake.state = 'Alarm';
    },
  };

  function answer(response) {
    if (response === null || response === undefined) return;
    const items = Array.isArray(response) ? response : [response];
    for (const item of items) {
      const { text, delayMs: after = delayMs } = typeof item === 'string' ? { text: item } : item;
      if (/^(ok|error:)/.test(text)) {
        setTimeout(() => {
          fake.inFlight--;
        }, after);
      }
      fake.emit(`${text}\r\n`, after);
    }
  }

  const head = () => (fake.substate === undefined ? fake.state : `${fake.state}:${fake.substate}`);

  function finishHold() {
    fake.substate = '0';
    fake.holdDoneAt = Date.now();
  }

  function take(c) {
    if (c === '?' || c === '!' || c === '~' || c === '\x18') {
      fake.realtime.push(c);
      fake.log.push({ c, at: Date.now(), head: head() });
    }
    if (c === '?') {
      if (answersStatus) fake.emit(`<${head()}|MPos:0.000,0.000,0.000|FS:0,0>\r\n`);
    } else if (c === '!' || c === '~') {
      if (c === '!' && honoursHold && fake.state !== 'Hold') {
        fake.state = 'Hold';
        if (holdMs > 0) {
          fake.substate = '1';
          setTimeout(() => {
            if (fake.state === 'Hold') finishHold();
          }, holdMs);
        } else {
          finishHold();
        }
      }
    } else if (c === '\x18') {
      partial = '';
      fake.state = 'Idle';
      fake.substate = undefined;
      if (bannerOnReset) fake.boot();
    } else if (c === '\n' || c === '\r') {
      const line = partial;
      partial = '';
      fake.received.push(line);
      fake.inFlight++;
      fake.maxInFlight = Math.max(fake.maxInFlight, fake.inFlight);
      answer(line === '' ? 'ok' : reply(line, fake));
    } else {
      partial += c;
    }
  }

  return fake;
}
