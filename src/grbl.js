/*
 * Streams G-code to a GRBL 1.1 controller, one line at a time.
 *
 * GRBL answers every line with "ok" or "error:N". This uses the simple
 * send-and-wait protocol: send a line, wait for its answer, send the next.
 * It is slower than keeping GRBL's 128-byte receive buffer full, but it
 * always knows which line failed, and the drags are long moves, so the
 * motion planner never runs dry.
 *
 * It does not open serial ports. It takes a port object:
 *   port.write(text)       sends text (may return a promise)
 *   port.onData(callback)  calls callback(text) with whatever arrives, in
 *                          chunks of any size; may return an unsubscribe
 *                          function
 * so send.js can wrap a real serial port and the tests can use a fake GRBL.
 *
 * GRBL behaviour this relies on (checked against the GRBL 1.1h source):
 * - It prints "Grbl 1.1h ['$' for help]" whenever it starts. An Arduino Uno
 *   restarts when its serial port is opened, so connect() waits for that.
 * - With homing enabled ($22=1) it starts locked ("[MSG:'$H'|'$X' to
 *   unlock]") and answers G-code with error:9 until it has homed.
 * - "ALARM:N" can arrive at any time, for example from a limit switch.
 * - M8, M9 and G4 wait for every queued move to finish before GRBL answers,
 *   so one line can take many seconds. While waiting, the streamer asks for
 *   a status report ("?") every second, and pushes the timeout back for as
 *   long as GRBL reports that it is moving or paused (Hold, Door). A G4
 *   dwell then reports Idle while it waits, so its P seconds are added to
 *   that line's timeout.
 * - GRBL does not answer "?" while homing, so "$H" gets its own timeout.
 * - A line ends at '\r' or '\n', so lines go out with '\n' only ("\r\n"
 *   would be answered twice). GRBL keeps at most 79 characters of a line
 *   once spaces and comments are dropped.
 * - '?', '!', '~' and Ctrl-X act the moment they arrive, even mid-line, so
 *   lines containing them are refused.
 * - A soft reset (Ctrl-X) keeps the machine position, unless it comes
 *   mid-move (ALARM:3). A hardware reset or power-up clears it to 0,0, and
 *   opening the serial port usually resets an Uno that way (its DTR
 *   auto-reset).
 */

// GRBL 1.1 error codes: [name, what it means for this board].
export const GRBL_ERRORS = {
  1: ['Expected command letter', 'A G-code word is missing its letter.'],
  2: ['Bad number format', 'A number in the line is missing or could not be read. Check the file was not cut short or edited by hand.'],
  3: ['Invalid statement', 'GRBL does not know this $ command.'],
  4: ['Value < 0', 'A value that must be positive is negative.'],
  5: ['Setting disabled', 'Homing is not enabled. Set $22=1 once the endstops are wired, or run without --home.'],
  6: ['Value < 3 usec', 'The step pulse time ($0) must be at least 3 microseconds.'],
  7: ['EEPROM read fail', 'GRBL could not read its settings and restored defaults. Enter the $ settings again.'],
  8: ['Not idle', 'This $ command only works while GRBL is idle.'],
  9: ['G-code lock', 'GRBL refuses G-code while it is in an alarm state. Home it first (send.js --home, or $H), or unlock it with $X once the machine is safe.'],
  10: ['Homing not enabled', 'Soft limits ($20=1) need homing ($22=1) turned on first.'],
  11: ['Line overflow', 'The line is longer than GRBL can hold (79 characters without spaces and comments).'],
  12: ['Step rate > 30kHz', 'A $ setting would make GRBL step faster than it can. Lower the maximum speed or the steps per mm.'],
  13: ['Check door', 'The safety door input is open.'],
  14: ['Line length exceeded', 'The build info or startup line is too long to store.'],
  15: ['Travel exceeded', 'A jog would go past the machine travel ($130/$131).'],
  16: ['Invalid jog command', 'A $J= jog command is malformed.'],
  17: ['Setting disabled', 'Laser mode needs PWM output.'],
  20: ['Unsupported command', 'GRBL does not support a G or M code in this line. The magnet uses M8/M9; M7 only works if GRBL was built with ENABLE_M7.'],
  21: ['Modal group violation', 'Two commands from the same group are in one line.'],
  22: ['Undefined feed rate', 'A G1 move has no F speed and none was set earlier.'],
  23: ['Command needs an integer', 'A G or M code in this line needs a whole number.'],
  24: ['Axis command conflict', 'Two commands in one line both use the X/Y values, for example G0 and G1 together, or G1 with G28 or G92.'],
  25: ['Repeated word', 'The same letter appears twice in one line.'],
  26: ['No axis words', 'A command that needs X or Y values has none.'],
  27: ['Invalid line number', 'The N line number is not valid.'],
  28: ['Missing value', 'A command is missing a value it needs, for example G4 without P.'],
  29: ['Unsupported coordinate system', 'G59.1, G59.2 and G59.3 are not supported.'],
  30: ['G53 needs G0 or G1', 'G53 only works with G0 and G1 moves.'],
  31: ['Unused axis words', 'X or Y values are in a line with no command that uses them.'],
  32: ['Arc needs an in-plane axis', 'A G2/G3 arc has no axis word in the selected plane.'],
  33: ['Invalid target', 'The motion target is not valid.'],
  34: ['Arc radius error', 'The arc radius is not valid.'],
  35: ['Arc needs an offset', 'A G2/G3 arc has no in-plane offset.'],
  36: ['Unused value words', 'The line has values that no command uses.'],
  37: ['Tool length axis', 'G43.1 is not assigned to the tool length axis.'],
  38: ['Tool number too large', 'The tool number is larger than GRBL supports.'],
};

// GRBL 1.1 alarm codes: [name, what it means for this board].
export const GRBL_ALARMS = {
  1: ['Hard limit', 'An endstop was hit during a move (hard limits, $21=1). The position is probably lost: home again. Check for a move past the end of travel, or electrical noise on the endstop wires.'],
  2: ['Soft limit', 'A move in the G-code goes outside the travel set by $130/$131, so GRBL stopped before making it. Check the calibration puts every cell inside the travel and that $130/$131 match the frame, then home again (send.js --home): send.js resets the Arduino each time it connects, which clears the position.'],
  3: ['Reset during a move', 'GRBL was reset while moving. The position is probably lost: home again.'],
  4: ['Probe fail', 'The probe input was not in the expected state at the start of a probe move.'],
  5: ['Probe fail', 'The probe did not trigger within the programmed travel.'],
  6: ['Homing fail', 'Homing was interrupted by a reset.'],
  7: ['Homing fail', 'The safety door opened during homing.'],
  8: ['Homing fail', 'After touching an endstop, backing off by the pull-off distance ($27) did not release it. Increase $27 or check the switch wiring.'],
  9: ['Homing fail', 'No endstop was found within the search distance. Check the switch wiring (normally open, between signal and GND), the homing direction mask ($23), and that GRBL is built to home X and Y only: stock GRBL 1.1 homes Z first (HOMING_CYCLE_0 in config.h), which fails on a board with no Z switch.'],
  10: ['Homing fail', 'The second switch of a dual-motor axis did not trigger.'],
};

export const MAX_LINE_CHARS = 79; // GRBL's 80-byte line buffer, less the terminator
// While GRBL reports one of these, a line is still in progress: Hold and
// Door are pauses (the shield's Hold pin, or a safety door) that last until
// cycle start or a reset, so a waiting line waits with them.
const BUSY_STATES = new Set(['Run', 'Jog', 'Home', 'Hold', 'Door']);

export class GrblError extends Error {
  // kind: 'error', 'alarm', 'timeout', 'reset', 'locked', 'no-reply',
  // 'closed', 'aborted' or 'gcode' (a line refused before sending).
  constructor(kind, message, details = {}) {
    super(message);
    this.name = 'GrblError';
    this.kind = kind;
    Object.assign(this, details);
  }
}

export function describeError(code) {
  const [name, meaning] = GRBL_ERRORS[code] ?? ['Unknown error', 'See the GRBL 1.1 error code list.'];
  return `error:${code} ${name}. ${meaning}`;
}

export function describeAlarm(code) {
  const [name, meaning] = GRBL_ALARMS[code] ?? ['Unknown alarm', 'See the GRBL 1.1 alarm code list.'];
  return `ALARM:${code} ${name}. ${meaning}`;
}

// Splits one line of G-code into the part GRBL runs and its comments, the
// way GRBL does: '(' starts a comment that ends at ')', ';' runs to the end.
function splitComment(raw) {
  let code = '';
  let comment = '';
  let inParens = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inParens) {
      if (c === ')') inParens = false;
      else comment += c;
    } else if (c === '(') {
      inParens = true;
    } else if (c === ';') {
      comment += raw.slice(i + 1);
      break;
    } else {
      code += c;
    }
  }
  return { code: code.trim(), comment: comment.trim() };
}

/*
 * Turns G-code text into the lines to send: comments, blank lines and '%'
 * markers removed. Each line keeps its line number in the file (source) and
 * the last whole-line comment before it (note); toGcode writes one naming
 * each move, which send.js shows as progress. Throws a GrblError of kind
 * 'gcode' for a line GRBL could not take.
 */
export function prepareGcode(text) {
  const raw = text.split(/\r\n|\r|\n/);
  if (raw.at(-1) === '') raw.pop(); // the newline at the end of the file
  const lines = [];
  let skipped = 0;
  let note = '';
  raw.forEach((rawLine, i) => {
    const source = i + 1;
    const { code, comment } = splitComment(rawLine);
    if (!code || code === '%') {
      if (!code && comment) note = comment;
      skipped++;
      return;
    }
    if (/[?!~]/.test(code) || /[^\x20-\x7e\t]/.test(code)) {
      throw new GrblError('gcode', `Line ${source} ("${code}") contains ? ! ~ or a control or non-ASCII character. GRBL acts on those the moment they arrive, or throws them away.`, { source, line: code });
    }
    const length = code.replace(/[\s/]/g, '').length;
    if (length > MAX_LINE_CHARS) {
      throw new GrblError('gcode', `Line ${source} is ${length} characters long without spaces; GRBL holds at most ${MAX_LINE_CHARS}.`, { source, line: code });
    }
    lines.push({ text: code, source, note });
  });
  return { lines, skipped };
}

// Seconds a G4 dwell in this line waits (GRBL takes G4's P in seconds), or 0.
export function dwellSeconds(text) {
  const code = String(text).replace(/\s/g, '').toUpperCase();
  if (!/G0*4(?![\d.])/.test(code)) return 0;
  const m = /P(\d*\.?\d+)/.exec(code);
  return m ? Number(m[1]) : 0;
}

// Classifies one line received from GRBL.
export function parseResponse(line) {
  if (line === 'ok') return { type: 'ok' };
  let m = /^error:\s*(\d+)$/i.exec(line);
  if (m) return { type: 'error', code: Number(m[1]) };
  m = /^error:\s*(.*)$/i.exec(line); // GRBL 0.9 sends text instead of a number
  if (m) return { type: 'error', code: null, text: m[1] };
  m = /^ALARM:\s*(\d+)$/i.exec(line);
  if (m) return { type: 'alarm', code: Number(m[1]) };
  m = /^ALARM:\s*(.*)$/i.exec(line);
  if (m) return { type: 'alarm', code: null, text: m[1] };
  if (line.startsWith('<') && line.endsWith('>')) {
    const [head, ...fields] = line.slice(1, -1).split('|');
    const [state, substate] = head.split(':');
    return { type: 'status', state, substate, fields };
  }
  m = /^\[MSG:(.*)\]$/.exec(line);
  if (m) return { type: 'message', text: m[1] };
  m = /Grbl (\d+\.\d+\w*)/.exec(line);
  if (m && !line.startsWith('[')) return { type: 'banner', version: m[1] };
  return { type: 'other', text: line };
}

const LOCK_MESSAGE = "'$H'|'$X' to unlock";

/*
 * Creates a session on a port. Options (all optional):
 *   lineTimeoutMs     how long GRBL may stay silent or idle without answering
 *                     a line (default 10 s; pushed back while it moves or is
 *                     paused, and longer by a G4 line's dwell)
 *   homeTimeoutMs     how long "$H" may take (default 5 min). GRBL ends a
 *                     homing run itself, with ok or ALARM:8/9, once it has
 *                     searched 1.5 x the travel at the seek rate ($25), so
 *                     this only catches a dead connection
 *   statusIntervalMs  how often to ask for a status report while waiting
 *                     (default 1000; 0 turns it off)
 *   onMessage(text)   called with [MSG:...] text and other lines GRBL sends
 *   onStatus(status)  called with each parsed status report; a caller can
 *                     watch it to tell the user GRBL is paused (Hold, Door)
 */
export function createGrbl(port, options = {}) {
  const {
    lineTimeoutMs = 10000,
    homeTimeoutMs = 300000,
    statusIntervalMs = 1000,
    onMessage = () => {},
    onStatus = () => {},
  } = options;

  let buffer = '';
  let pending = null; // the line waiting for its answer
  let stopError = null; // set once the session can't go on
  let version = null; // from the last banner
  let expectBanner = true; // a banner now is not a surprise
  let locked = false; // GRBL refuses G-code until "$H" or "$X"
  const bannerWaiters = [];
  const statusWaiters = [];

  function write(text) {
    try {
      const result = port.write(text);
      if (result && typeof result.then === 'function') {
        result.catch((err) => abort(new GrblError('closed', `Could not write to the port: ${err.message}`)));
      }
    } catch (err) {
      abort(new GrblError('closed', `Could not write to the port: ${err.message}`));
    }
  }

  function finish(error) {
    const entry = pending;
    if (!entry) return;
    pending = null;
    clearTimeout(entry.timer);
    clearInterval(entry.poll);
    if (error) {
      entry.reject(error);
    } else {
      if (/^\$[HX]$/i.test(entry.text)) locked = false;
      entry.resolve();
    }
  }

  // Ends the session: the waiting line and every later one fail with error.
  function abort(error) {
    if (!stopError) stopError = error;
    finish(error);
  }

  function where(entry) {
    return `${entry.source ? `line ${entry.source} ` : ''}"${entry.text}"`;
  }

  function handleLine(line) {
    const response = parseResponse(line);
    switch (response.type) {
      case 'ok':
        finish(null);
        break;
      case 'error':
        if (pending) {
          const what = response.code === null ? `error: ${response.text}` : describeError(response.code);
          finish(new GrblError('error', `GRBL rejected ${where(pending)}: ${what}`, {
            code: response.code,
            line: pending.text,
            source: pending.source,
          }));
        }
        break;
      case 'alarm': {
        locked = true;
        const what = response.code === null ? `ALARM: ${response.text}` : describeAlarm(response.code);
        abort(new GrblError('alarm', `GRBL raised ${what}${pending ? ` (while sending ${where(pending)})` : ''}`, {
          code: response.code,
          line: pending?.text,
          source: pending?.source,
        }));
        break;
      }
      case 'banner':
        version = response.version;
        if (expectBanner) {
          locked = false; // the lock message, if any, follows the banner
          for (const waiter of bannerWaiters.splice(0)) waiter(response.version);
        } else {
          abort(new GrblError('reset', 'GRBL restarted in the middle of the job (a power dip, a USB reset or the reset button). Queued moves were lost: check the pieces, then home and start again.'));
        }
        break;
      case 'status':
        onStatus(response);
        for (const waiter of statusWaiters.splice(0)) waiter(response);
        if (pending && BUSY_STATES.has(response.state)) armTimeout(pending);
        break;
      case 'message':
        if (response.text === LOCK_MESSAGE) locked = true;
        onMessage(response.text);
        break;
      default:
        onMessage(response.text);
    }
  }

  function handleData(chunk) {
    buffer += chunk;
    const parts = buffer.split(/\r\n|\r|\n/);
    buffer = parts.pop();
    for (const part of parts) {
      const line = part.replace(/[^\x20-\x7e]/g, '').trim();
      if (line) handleLine(line);
    }
  }

  const unsubscribe = port.onData(handleData);

  function armTimeout(entry) {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      if (pending !== entry) return;
      const seconds = entry.timeoutMs >= 1000 ? `${Math.round(entry.timeoutMs / 1000)} s` : `${entry.timeoutMs} ms`;
      finish(new GrblError('timeout', `No answer from GRBL to ${where(entry)} after ${seconds}.`, {
        line: entry.text,
        source: entry.source,
      }));
    }, entry.timeoutMs);
  }

  // Sends one line and waits for its "ok". Rejects with a GrblError.
  function sendLine(text, { source, timeoutMs } = {}) {
    if (pending) return Promise.reject(new Error('sendLine was called while another line is waiting for its answer'));
    if (stopError) return Promise.reject(stopError);
    return new Promise((resolve, reject) => {
      const entry = {
        text,
        source,
        resolve,
        reject,
        timeoutMs: timeoutMs ?? (/^\$H$/i.test(text) ? homeTimeoutMs : lineTimeoutMs + dwellSeconds(text) * 1000),
      };
      pending = entry; // before writing: a fast port may answer inside write()
      armTimeout(entry);
      if (statusIntervalMs > 0) entry.poll = setInterval(() => write('?'), statusIntervalMs);
      write(`${text}\n`);
    });
  }

  function waitFor(waiters, timeoutMs) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const i = waiters.indexOf(done);
        if (i >= 0) waiters.splice(i, 1);
        resolve(null);
      }, timeoutMs);
      function done(value) {
        clearTimeout(timer);
        resolve(value);
      }
      waiters.push(done);
    });
  }

  // Asks for one status report. Resolves with it, or null if none came.
  function queryStatus(timeoutMs = 1000) {
    const waiting = waitFor(statusWaiters, timeoutMs);
    write('?');
    return waiting;
  }

  /*
   * Waits for GRBL's start-up banner. If it doesn't come (the board didn't
   * restart when the port opened), sends a soft reset (Ctrl-X), which makes
   * GRBL print it again. Then asks for a status report to learn whether GRBL
   * is locked. Resolves with { version, state, locked }.
   */
  async function connect({ timeoutMs = 5000, softReset = true } = {}) {
    expectBanner = true;
    let found = version ?? (await waitFor(bannerWaiters, timeoutMs));
    if (!found && softReset) {
      const waiting = waitFor(bannerWaiters, timeoutMs);
      write('\x18');
      found = await waiting;
    }
    if (!found) {
      throw new GrblError('no-reply', 'No answer from GRBL on this port. Check the port name, that GRBL 1.1 is flashed on the Arduino, and the speed (GRBL 1.1 uses 115200 baud).');
    }
    expectBanner = false;
    const status = await queryStatus(1000);
    if (status?.state === 'Alarm') locked = true;
    return { version: found, state: status?.state ?? 'unknown', locked };
  }

  /*
   * Sends a whole program. Options:
   *   home            send "$H" first
   *   waitForFinish   end with "G4 P0", which GRBL only answers once the
   *                   last move has finished (default true)
   *   onProgress(p)   called with { phase: 'home' } before homing, then
   *                   { phase: 'line', sent, total, line } after each line,
   *                   then { phase: 'finish' }
   * Resolves with { lines, ms }. Stops at the first error, alarm or timeout
   * and rejects with a GrblError.
   */
  async function stream(gcode, { home = false, waitForFinish = true, onProgress = () => {} } = {}) {
    const { lines } = typeof gcode === 'string' ? prepareGcode(gcode) : { lines: gcode };
    if (stopError) throw stopError;
    if (locked && !home) {
      throw new GrblError('locked', 'GRBL is locked until the machine homes: it starts locked when homing is on ($22=1), and locks after an alarm. Run again with --home.');
    }
    const start = Date.now();
    if (home) {
      onProgress({ phase: 'home' });
      await sendLine('$H');
    }
    for (let i = 0; i < lines.length; i++) {
      await sendLine(lines[i].text, { source: lines[i].source });
      onProgress({ phase: 'line', sent: i + 1, total: lines.length, line: lines[i] });
    }
    if (waitForFinish) {
      onProgress({ phase: 'finish' });
      await sendLine('G4 P0');
    }
    return { lines: lines.length, ms: Date.now() - start };
  }

  /*
   * Stops the machine cleanly: a feed hold ('!'), a wait (up to waitMs)
   * until the carriage has stopped, then a soft reset (Ctrl-X), which also
   * switches the magnet off and throws away anything still queued. A reset
   * after the hold has finished keeps GRBL's position and raises no alarm;
   * a reset mid-move would raise ALARM:3. The position only lasts until the
   * next hardware reset, and opening the port again resets an Uno.
   */
  async function stopSafely({ waitMs = 3000 } = {}) {
    abort(new GrblError('aborted', 'Stopped.'));
    write('!');
    const until = Date.now() + waitMs;
    while (Date.now() < until) {
      const status = await queryStatus(Math.min(250, Math.max(1, until - Date.now())));
      if (status && (status.state === 'Idle' || status.state === 'Alarm' || (status.state === 'Hold' && status.substate === '0'))) break;
    }
    expectBanner = true;
    write('\x18');
  }

  function close() {
    finish(new GrblError('aborted', 'The session was closed.'));
    for (const waiter of [...bannerWaiters.splice(0), ...statusWaiters.splice(0)]) waiter(null);
    if (typeof unsubscribe === 'function') unsubscribe();
  }

  return {
    connect,
    sendLine,
    stream,
    queryStatus,
    stopSafely,
    abort,
    close,
    get locked() {
      return locked;
    },
    get version() {
      return version;
    },
  };
}
