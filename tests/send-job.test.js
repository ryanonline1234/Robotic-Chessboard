import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareGcode } from '../src/grbl.js';
import { STOPPED, createJob } from '../src/send-job.js';
import { createFakeGrbl } from './fake-grbl.js';

// send.js's steps, run against a fake GRBL instead of a serial port.

const FAST = {
  grblOptions: { lineTimeoutMs: 200, homeTimeoutMs: 1000, statusIntervalMs: 10 },
  connectTimeoutMs: 200,
  magnetOffMs: 500,
  stopWaitMs: 300,
  settleMs: 10,
};

const { lines } = prepareGcode(
  [
    '; robotic chessboard plan',
    'G21',
    'G90',
    'M9',
    '; 1. N g1 -> f3 (direct)',
    'G0 X300.0 Y20.0',
    'M8',
    'G4 P0.01',
    'G1 X280.0 Y60.0 F2000',
    'G1 X260.0 Y100.0 F2000',
    'M9',
    'G4 P0.01',
    'G0 X20.0 Y20.0 ; park',
  ].join('\n'),
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(condition, timeoutMs = 2000) {
  const end = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await delay(5);
  }
}

// A fake GRBL that has just started (locked, as with homing on) and a job on it.
function setup(reply, { locked = true, fake: fakeOptions = {} } = {}) {
  const homes = (line, f) => (line === '$H' ? ((f.state = 'Idle'), 'ok') : reply(line, f));
  const fake = createFakeGrbl({ reply: homes, ...fakeOptions });
  fake.boot({ locked });
  const said = [];
  const job = createJob(fake.port, { ...FAST, say: (text) => said.push(text) });
  return { fake, job, said: () => said.join('\n') };
}

const resets = (fake) => fake.realtime.filter((c) => c !== '?');

test('homes, streams the job and finishes', async () => {
  const { fake, job, said } = setup(() => 'ok');
  assert.equal(await job.run(lines, { home: true }), 0);
  assert.equal(fake.received[0], '$H');
  assert.equal(fake.received.at(-1), 'G4 P0');
  assert.equal(fake.received.length, lines.length + 2);
  assert.match(said(), /Connected to Grbl 1\.1h \(Alarm\)/);
  assert.match(said(), /Done: \d+ lines/);
  assert.deepEqual(resets(fake), [], 'no hold or reset');
  job.close();
});

test('it will not start from a 0,0 that may be anywhere', async () => {
  // Not locked: homing is off, or the board did not restart.
  const unlocked = setup(() => 'ok', { locked: false });
  assert.equal(await unlocked.job.run(lines), 1);
  assert.deepEqual(unlocked.fake.received, [], 'nothing sent');
  assert.match(unlocked.said(), /--no-home/);
  unlocked.job.close();

  const allowed = setup(() => 'ok', { locked: false });
  assert.equal(await allowed.job.run(lines, { noHome: true }), 0);
  assert.equal(allowed.fake.received[0], 'G21');
  allowed.job.close();

  // Locked, and --no-home can't change that.
  const locked = setup(() => 'ok');
  assert.equal(await locked.job.run(lines, { noHome: true }), 1);
  assert.deepEqual(locked.fake.received, []);
  assert.match(locked.said(), /locked until the machine homes.*--home/);
  locked.job.close();
});

test('an error stops the job, then M9 switches the magnet off', async () => {
  const { fake, job, said } = setup((line) => (line.startsWith('G1') ? 'error:22' : 'ok'));
  assert.equal(await job.run(lines, { home: true }), 1);
  assert.deepEqual(fake.received.slice(-2), ['G1 X280.0 Y60.0 F2000', 'M9']);
  assert.match(said(), /line 9 .*Undefined feed rate/);
  assert.match(said(), /Sent M9: the magnet is off/);
  assert.deepEqual(resets(fake), []);
  job.close();
});

test('Ctrl-C while the magnet-off M9 waits still holds and resets', async () => {
  // GRBL rejects a drag, then the M9 waits behind moves that are still running.
  const { fake, job, said } = setup((line, f) => {
    if (line.startsWith('G1')) return 'error:22';
    if (line === 'M9' && f.received.includes('G1 X280.0 Y60.0 F2000')) {
      f.state = 'Run';
      return null;
    }
    return 'ok';
  }, { fake: { holdMs: 50 } });
  const running = job.run(lines, { home: true });
  await until(() => fake.received.at(-1) === 'M9' && fake.received.includes('G1 X280.0 Y60.0 F2000'));
  await delay(20);
  job.stop();
  const code = await running;
  const finished = Date.now();
  assert.equal(code, STOPPED);
  assert.deepEqual(resets(fake), ['!', '\x18'], 'one hold, then one reset');
  const reset = fake.log.find((e) => e.c === '\x18');
  assert.equal(reset.head, 'Hold:0', 'reset once the carriage had stopped');
  assert.ok(reset.at <= finished, 'the reset went out before run() returned');
  assert.doesNotMatch(said(), /Could not switch the magnet off/);
  assert.match(said(), /Stopped\. .*--home/);
  job.close();
});

test('a line with no answer: hold, reset, and a second stop does not repeat them', async () => {
  const { fake, job, said } = setup((line) => (line === 'M8' ? null : 'ok'));
  const running = job.run(lines, { home: true });
  await until(() => fake.realtime.includes('!'));
  job.stop(); // Ctrl-C while the timeout's own stop is under way
  job.stop();
  assert.equal(await running, STOPPED);
  assert.deepEqual(resets(fake), ['!', '\x18']);
  assert.match(said(), /No answer from GRBL to line 7 "M8"/);
  job.close();
});

test('a timeout on its own holds, resets and fails', async () => {
  const { fake, job, said } = setup((line) => (line === 'M8' ? null : 'ok'));
  assert.equal(await job.run(lines, { home: true }), 1);
  assert.deepEqual(resets(fake), ['!', '\x18']);
  assert.match(said(), /Stopping the machine/);
  job.close();
});

test('an alarm stops the job; nothing more is sent', async () => {
  const { fake, job, said } = setup((line, f) => {
    if (line !== 'M8') return 'ok';
    f.emit('ALARM:1\r\n[MSG:Reset to continue]\r\n', 5);
    return null;
  });
  assert.equal(await job.run(lines, { home: true }), 1);
  await delay(30);
  assert.equal(fake.received.at(-1), 'M8');
  assert.match(said(), /ALARM:1 Hard limit/);
  assert.match(said(), /run again with --home/);
  job.close();
});

test('a pause from the Hold pin is reported, and the job waits it out', async () => {
  // The builder presses Hold during the first drag and Resume 300 ms later,
  // longer than the 200 ms line timeout.
  const { fake, job, said } = setup((line, f) => {
    if (line !== 'G1 X280.0 Y60.0 F2000') return 'ok';
    f.state = 'Hold';
    f.substate = '0';
    setTimeout(() => {
      f.state = 'Idle';
      f.substate = undefined;
    }, 300);
    return { text: 'ok', delayMs: 320 };
  });
  assert.equal(await job.run(lines, { home: true }), 0);
  assert.equal(said().match(/GRBL is paused \(feed hold/g).length, 1, 'said once, not at every status report');
  assert.match(said(), /GRBL is running again/);
  assert.deepEqual(resets(fake), []);
  job.close();
});

test('stop() outside a run does nothing', async () => {
  const { fake, job } = setup(() => 'ok');
  await job.stop();
  await delay(20);
  assert.deepEqual(fake.writes, []);
  job.close();
});
