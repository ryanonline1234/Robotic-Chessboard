/*
 * One run of send.js against a GRBL controller: connect, make sure GRBL
 * knows where the machine is, stream the G-code, and leave the machine safe
 * after an error, an alarm, a timeout or a stop request (Ctrl-C).
 *
 * It takes the same port object as src/grbl.js (write and onData), so the
 * tests run it against a fake GRBL; send.js wraps the real serial port.
 *
 *   const job = createJob(port, { say, onProgress });
 *   process.on('SIGINT', () => job.stop());
 *   const exitCode = await job.run(lines, { home: true });
 *
 * run() resolves with 0 when the job finished, 1 when it failed, and
 * STOPPED (130, the usual exit code after Ctrl-C) when stop() was called.
 * It only resolves once any stop in progress has sent its reset, so the
 * caller can close the port as soon as it does.
 */
import { GrblError, createGrbl } from './grbl.js';

export const STOPPED = 130;

const UNHOMED =
  'GRBL did not ask to be homed, so homing is off ($22=0) or the Arduino kept running from an earlier session. ' +
  'Its 0,0 is wherever the carriage was when GRBL last started or homed, which may not be where this G-code expects. ' +
  'Run again with --home to home first, or add --no-home to send the job from the position GRBL has now.';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function duration(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

/*
 * Options (all optional):
 *   say(text)         prints a message for the builder
 *   onProgress(p)     passed on to grbl.stream
 *   grblOptions       passed on to createGrbl (timeouts, status interval)
 *   connectTimeoutMs  how long to wait for GRBL's start-up banner (5 s)
 *   magnetOffMs       how long the M9 after an error may take (30 s)
 *   stopWaitMs        how long a stop waits for the carriage to halt
 *                     before it resets anyway (3 s)
 *   settleMs          pause after the reset so it leaves the port before
 *                     the port closes (300 ms)
 */
export function createJob(port, options = {}) {
  const {
    say = () => {},
    onProgress = () => {},
    grblOptions = {},
    connectTimeoutMs = 5000,
    magnetOffMs = 30000,
    stopWaitMs = 3000,
    settleMs = 300,
  } = options;

  let running = false;
  let halting = null; // the stop in progress, once one has started
  let stopRequested = false; // stop() was called
  let paused = false;

  // GRBL can pause by itself (the shield's Hold pin, a safety door). The
  // line being sent then waits for as long as the pause lasts, so say why.
  function noticePause(status) {
    const now = status.state === 'Hold' || status.state === 'Door';
    if (running && !halting && now !== paused) {
      if (!now) say('GRBL is running again.');
      else if (status.state === 'Door') say('GRBL is paused: the safety door input is open. Close it and press cycle start (the shield\'s Resume pin) to carry on, or Ctrl-C to stop.');
      else say('GRBL is paused (feed hold, from the shield\'s Hold pin). Press cycle start (the Resume pin) to carry on, or Ctrl-C to stop.');
    }
    paused = now;
  }

  // Status reports stop once the waiting line is answered, so the next
  // line's progress is also the sign that a pause is over.
  function progress(p) {
    if (paused && !halting) say('GRBL is running again.');
    paused = false;
    onProgress(p);
  }

  const grbl = createGrbl(port, {
    ...grblOptions,
    onMessage: (text) => say(`GRBL: ${text}`),
    onStatus: noticePause,
  });

  // Feed hold, wait for the carriage to stop, soft reset (magnet off).
  // However many times it is asked for, this runs once.
  function halt() {
    if (!halting) {
      halting = (async () => {
        await grbl.stopSafely({ waitMs: stopWaitMs });
        await delay(settleMs);
      })();
    }
    return halting;
  }

  // Stops the job (Ctrl-C). Safe to call at any time, and more than once.
  function stop() {
    if (!running) return Promise.resolve();
    if (!stopRequested) {
      stopRequested = true;
      say('\nStopping: feed hold, then a reset once the carriage has stopped (this switches the magnet off)...');
    }
    return halt();
  }

  // Waits for the stop in progress to send its reset, then reports.
  async function stopped() {
    await halting;
    say('Stopped. The piece that was moving may be between squares. Run again with --home before the next job: send.js resets the Arduino when it connects.');
    return stopRequested ? STOPPED : 1;
  }

  // After an error: moves already queued still run, so switch the magnet
  // off once they have finished.
  async function magnetOff() {
    try {
      await grbl.sendLine('M9', { timeoutMs: magnetOffMs });
      say('Sent M9: the magnet is off. Pieces may be off their squares; check the board before the next job.');
    } catch (err) {
      if (halting) return; // a stop is under way; it switches the magnet off
      if (err.kind === 'alarm' || err.kind === 'reset') {
        say(`${err.message}\nGRBL reset itself, which switches the magnet off.`);
      } else if (err.kind === 'closed') {
        say(`Could not switch the magnet off: ${err.message} Switch off the 12 V supply.`);
      } else {
        say(`M9 did not go through (${err.message}). Stopping the machine (feed hold, then reset) to switch the magnet off...`);
        halt();
      }
    }
  }

  async function attempt(lines, { home, noHome }) {
    try {
      const hello = await grbl.connect({ timeoutMs: connectTimeoutMs });
      say(`Connected to Grbl ${hello.version} (${hello.state}).`);
      if (!hello.version.startsWith('1.1')) say(`Warning: send.js is written for GRBL 1.1; this is ${hello.version}.`);
      if (!hello.locked && !home && !noHome) throw new GrblError('unhomed', UNHOMED);
      const result = await grbl.stream(lines, { home, onProgress: progress });
      say(`Done: ${result.lines} lines in ${duration(result.ms)}.`);
      return 0;
    } catch (err) {
      if (halting) return stopped();
      say(`\n${err.message}`);
      if (err.kind === 'error') {
        await magnetOff();
      } else if (err.kind === 'timeout') {
        say('Stopping the machine (feed hold, then reset)...');
        halt();
      } else if (err.kind === 'alarm') {
        say('GRBL stopped and switched the magnet off. Fix the cause, then run again with --home (send.js resets the Arduino when it connects).');
      }
      if (halting) return stopped();
      return 1;
    }
  }

  /*
   * Runs the job. lines come from prepareGcode. Options:
   *   home     home ($H) first
   *   noHome   send without homing even though GRBL is not locked
   * Without either, a GRBL that is not locked (so not waiting to be homed)
   * is refused: its 0,0 may be anywhere.
   */
  async function run(lines, { home = false, noHome = false } = {}) {
    running = true;
    try {
      return await attempt(lines, { home, noHome });
    } finally {
      running = false;
    }
  }

  return {
    run,
    stop,
    close: () => grbl.close(),
    grbl,
    get running() {
      return running;
    },
  };
}
