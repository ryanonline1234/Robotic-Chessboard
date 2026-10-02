import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoard } from '../src/board.js';
import { toGcode } from '../src/gcode.js';
import {
  GRBL_ALARMS,
  GRBL_ERRORS,
  GrblError,
  createGrbl,
  describeAlarm,
  describeError,
  dwellSeconds,
  parseResponse,
  prepareGcode,
} from '../src/grbl.js';
import { planArrangement } from '../src/planner.js';
import { scenario } from '../src/scenarios.js';
import { createFakeGrbl } from './fake-grbl.js';

const FAST = { lineTimeoutMs: 200, homeTimeoutMs: 1000, statusIntervalMs: 10 };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SAMPLE = [
  '; robotic chessboard plan',
  'G21 ; millimetres',
  '',
  '   ',
  '(set up) G90',
  '%',
  '; 1. N g1 -> f3 (direct)',
  'G0 X340.0 Y20.0',
  'M8',
  'G1 X300.0 Y100.0 F2000 (drag)',
  'M9',
].join('\r\n');

test('comments, blank lines and % markers are left out; line numbers and notes are kept', () => {
  const { lines, skipped } = prepareGcode(`${SAMPLE}\n`);
  assert.deepEqual(lines.map((l) => l.text), ['G21', 'G90', 'G0 X340.0 Y20.0', 'M8', 'G1 X300.0 Y100.0 F2000', 'M9']);
  assert.deepEqual(lines.map((l) => l.source), [2, 5, 8, 9, 10, 11]);
  assert.equal(lines[0].note, 'robotic chessboard plan');
  assert.equal(lines[2].note, '1. N g1 -> f3 (direct)');
  assert.equal(skipped, 5);
  // A ';' inside parentheses is part of that comment, as in GRBL.
  assert.deepEqual(prepareGcode('G0 (a;b) X1').lines.map((l) => l.text), ['G0  X1']);
});

test('lines GRBL could not take are refused before anything is sent', () => {
  assert.throws(() => prepareGcode('G0 X1\nG1 X2 ? Y3'), (err) => err instanceof GrblError && err.kind === 'gcode' && err.source === 2);
  assert.throws(() => prepareGcode('G4 P1 !'), /the moment they arrive/);
  const long = `G1 ${'X1.0 '.repeat(20)}`;
  assert.throws(() => prepareGcode(long), /79/);
  // 79 characters without spaces is still fine.
  assert.equal(prepareGcode(`G1 X${'1'.repeat(76)}`).lines.length, 1);
});

test('responses are classified', () => {
  assert.deepEqual(parseResponse('ok'), { type: 'ok' });
  assert.deepEqual(parseResponse('error:22'), { type: 'error', code: 22 });
  assert.deepEqual(parseResponse('ALARM:9'), { type: 'alarm', code: 9 });
  assert.deepEqual(parseResponse("Grbl 1.1h ['$' for help]"), { type: 'banner', version: '1.1h' });
  assert.deepEqual(parseResponse("[MSG:'$H'|'$X' to unlock]"), { type: 'message', text: "'$H'|'$X' to unlock" });
  assert.equal(parseResponse('<Hold:0|MPos:1.000,2.000,0.000|FS:0,0>').substate, '0');
  assert.equal(parseResponse('>G54:ok').type, 'other'); // a startup line echo is not an "ok"
});

test('the codes a builder is likely to hit have plain explanations', () => {
  for (const code of [2, 9, 20, 22, 24]) assert.ok(GRBL_ERRORS[code], `error ${code}`);
  for (const code of [1, 2, 3, 8, 9]) assert.ok(GRBL_ALARMS[code], `alarm ${code}`);
  assert.match(describeError(9), /\$H/);
  assert.match(describeError(22), /^error:22 Undefined feed rate/);
  assert.match(describeAlarm(9), /HOMING_CYCLE_0/);
  assert.match(describeError(99), /Unknown/);
});

test('a planned job streams one line at a time, each waiting for its ok', async () => {
  const board = createBoard({ storageColumns: 1 });
  const { from, to } = scenario(board, 'reset', 1);
  const plan = planArrangement(board, from, to, { pieceDiameter: 0.475 });
  const gcode = toGcode(plan.moves, { squareMm: 40 });
  const fake = createFakeGrbl();
  const grbl = createGrbl(fake.port, FAST);
  const progress = [];
  const result = await grbl.stream(gcode, { onProgress: (p) => progress.push(p.phase) });
  const expected = prepareGcode(gcode).lines.map((l) => l.text);
  assert.deepEqual(fake.received, [...expected, 'G4 P0']);
  assert.equal(result.lines, expected.length);
  assert.equal(fake.maxInFlight, 1, 'never more than one line waiting');
  assert.ok(fake.writes.every((w) => !w.includes('\r')), 'lines end with \\n only');
  assert.equal(progress.filter((p) => p === 'line').length, expected.length);
  assert.equal(progress.at(-1), 'finish');
  grbl.close();
});

test('--home sends $H first and gives it longer than an ordinary line', async () => {
  const fake = createFakeGrbl({ reply: (line) => (line === '$H' ? { text: 'ok', delayMs: 120 } : 'ok') });
  const grbl = createGrbl(fake.port, { ...FAST, lineTimeoutMs: 50, statusIntervalMs: 0 });
  await grbl.stream('G21\nG90\n', { home: true });
  assert.deepEqual(fake.received, ['$H', 'G21', 'G90', 'G4 P0']);
  grbl.close();
});

test('error:N stops the job and names the line', async () => {
  const fake = createFakeGrbl({ reply: (line) => (line.startsWith('G1') ? 'error:22' : 'ok') });
  const grbl = createGrbl(fake.port, FAST);
  await assert.rejects(grbl.stream(SAMPLE), (err) => {
    assert.equal(err.kind, 'error');
    assert.equal(err.code, 22);
    assert.equal(err.source, 10);
    assert.equal(err.line, 'G1 X300.0 Y100.0 F2000');
    assert.match(err.message, /line 10 .*Undefined feed rate/);
    return true;
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(fake.received, ['G21', 'G90', 'G0 X340.0 Y20.0', 'M8', 'G1 X300.0 Y100.0 F2000'], 'nothing sent after the error');
  // The session is still usable, so the magnet can be switched off.
  await grbl.sendLine('M9');
  grbl.close();
});

test('ALARM stops the job, even when it arrives instead of an ok', async () => {
  const fake = createFakeGrbl({
    reply: (line, f) => {
      if (line !== 'M8') return 'ok';
      f.emit('ALARM:1\r\n[MSG:Reset to continue]\r\n', 5);
      return null;
    },
  });
  const grbl = createGrbl(fake.port, FAST);
  await assert.rejects(grbl.stream(SAMPLE), (err) => err.kind === 'alarm' && err.code === 1 && /Hard limit/.test(err.message) && err.source === 9);
  assert.equal(fake.received.at(-1), 'M8');
  await assert.rejects(grbl.sendLine('M9'), (err) => err.kind === 'alarm');
  assert.equal(fake.received.at(-1), 'M8', 'nothing sent after the alarm');
  grbl.close();
});

test('a line with no answer times out', async () => {
  const fake = createFakeGrbl({ reply: (line) => (line === 'M8' ? null : 'ok') });
  const grbl = createGrbl(fake.port, { ...FAST, lineTimeoutMs: 60 });
  const start = Date.now();
  await assert.rejects(grbl.stream(SAMPLE), (err) => err.kind === 'timeout' && err.source === 9 && /No answer/.test(err.message));
  assert.ok(Date.now() - start >= 55);
  grbl.close();
});

test('while GRBL reports it is moving, the timeout is pushed back', async () => {
  const slowSync = (line, f) => {
    if (line !== 'M9') return 'ok';
    f.state = 'Run';
    setTimeout(() => {
      f.state = 'Idle';
    }, 230);
    return { text: 'ok', delayMs: 250 };
  };
  const fake = createFakeGrbl({ reply: slowSync });
  const grbl = createGrbl(fake.port, { ...FAST, lineTimeoutMs: 80, statusIntervalMs: 10 });
  await grbl.stream(SAMPLE);
  assert.ok(fake.realtime.includes('?'), 'asked for status while waiting');
  grbl.close();

  // Without status reports the same wait is a timeout.
  const silent = createFakeGrbl({ reply: slowSync });
  const blind = createGrbl(silent.port, { ...FAST, lineTimeoutMs: 80, statusIntervalMs: 0 });
  await assert.rejects(blind.stream(SAMPLE), (err) => err.kind === 'timeout' && err.line === 'M9');
  blind.close();
});

test('messages, status reports and startup echoes in between are ignored', async () => {
  const fake = createFakeGrbl({
    reply: (line) => (line === 'G90' ? ['[MSG:Pgm End]', '<Idle|MPos:0.000,0.000,0.000|FS:0,0>', '>G54:ok', 'ok'] : 'ok'),
  });
  const messages = [];
  const grbl = createGrbl(fake.port, { ...FAST, onMessage: (m) => messages.push(m) });
  await grbl.stream(SAMPLE);
  assert.equal(fake.received.length, 7);
  assert.deepEqual(messages, ['Pgm End', '>G54:ok']);
  grbl.close();
});

test('connect waits for the banner and sees that GRBL is locked until it homes', async () => {
  const fake = createFakeGrbl({ reply: (line, f) => (line === '$H' ? ((f.state = 'Idle'), 'ok') : 'ok') });
  fake.boot({ locked: true, after: 20 });
  const grbl = createGrbl(fake.port, FAST);
  const hello = await grbl.connect({ timeoutMs: 500 });
  assert.deepEqual(hello, { version: '1.1h', state: 'Alarm', locked: true });
  await assert.rejects(grbl.stream('G21\n'), (err) => err.kind === 'locked' && /--home/.test(err.message));
  assert.deepEqual(fake.received, [], 'nothing sent while locked');
  await grbl.stream('G21\n', { home: true });
  assert.deepEqual(fake.received, ['$H', 'G21', 'G4 P0']);
  assert.equal(grbl.locked, false);
  grbl.close();
});

test('if the board did not restart, connect sends a soft reset to get the banner', async () => {
  const fake = createFakeGrbl();
  const grbl = createGrbl(fake.port, FAST);
  const hello = await grbl.connect({ timeoutMs: 40 });
  assert.equal(hello.version, '1.1h');
  assert.equal(hello.locked, false);
  assert.ok(fake.realtime.includes('\x18'));
  grbl.close();

  const dead = createFakeGrbl({ bannerOnReset: false, answersStatus: false });
  const nobody = createGrbl(dead.port, FAST);
  await assert.rejects(nobody.connect({ timeoutMs: 30 }), (err) => err.kind === 'no-reply' && /115200/.test(err.message));
  nobody.close();
});

test('a GRBL restart in the middle of a job stops it', async () => {
  const fake = createFakeGrbl({
    reply: (line, f) => {
      if (line !== 'M8') return 'ok';
      f.boot();
      return null;
    },
  });
  fake.boot();
  const grbl = createGrbl(fake.port, FAST);
  await grbl.connect({ timeoutMs: 200 });
  await assert.rejects(grbl.stream(SAMPLE), (err) => err.kind === 'reset' && /restarted/.test(err.message));
  grbl.close();
});

test('a G4 dwell gets its P seconds on top of the line timeout', async () => {
  assert.equal(dwellSeconds('G4 P0.25'), 0.25);
  assert.equal(dwellSeconds('g04p2'), 2);
  assert.equal(dwellSeconds('G4 P0'), 0);
  assert.equal(dwellSeconds('G40'), 0);
  assert.equal(dwellSeconds('G1 X4 F2000'), 0);
  // GRBL reports Idle while it dwells, so nothing else pushes the timeout back.
  const fake = createFakeGrbl({ reply: (line) => (line.startsWith('G4') ? { text: 'ok', delayMs: 250 } : 'ok') });
  const grbl = createGrbl(fake.port, { ...FAST, lineTimeoutMs: 100 });
  await grbl.sendLine('G4 P0.25');
  await assert.rejects(grbl.sendLine('G4 P0.05'), (err) => err.kind === 'timeout');
  grbl.close();
});

test('stopSafely holds, waits for the carriage to stop, then resets', async () => {
  // The carriage takes 100 ms to stop after '!', reporting Hold:1 until then.
  const fake = createFakeGrbl({ holdMs: 100, reply: (line, f) => ((f.state = 'Run'), null) });
  const grbl = createGrbl(fake.port, { ...FAST, lineTimeoutMs: 5000 });
  const job = assert.rejects(grbl.stream(SAMPLE), (err) => err.kind === 'aborted');
  await delay(20);
  await grbl.stopSafely({ waitMs: 1000 });
  await job;
  assert.deepEqual(fake.realtime.filter((c) => c !== '?'), ['!', '\x18']);
  const hold = fake.log.find((e) => e.c === '!');
  const reset = fake.log.find((e) => e.c === '\x18');
  assert.equal(hold.head, 'Run');
  assert.ok(fake.holdDoneAt - hold.at >= 95, 'the fake took its time to stop');
  assert.ok(fake.log.some((e) => e.c === '?' && e.head === 'Hold:1'), 'asked while the carriage was still stopping');
  assert.ok(fake.log.some((e) => e.c === '?' && e.head === 'Hold:0' && e.at <= reset.at), 'saw the hold complete before resetting');
  assert.equal(reset.head, 'Hold:0', 'the reset went out only once the carriage had stopped');
  grbl.close();
});

test('stopSafely resets after waitMs even if the carriage never reports stopped', async () => {
  const fake = createFakeGrbl({ honoursHold: false, reply: (line, f) => ((f.state = 'Run'), null) });
  const grbl = createGrbl(fake.port, { ...FAST, lineTimeoutMs: 5000 });
  const job = assert.rejects(grbl.stream(SAMPLE), (err) => err.kind === 'aborted');
  await delay(20);
  const start = Date.now();
  await grbl.stopSafely({ waitMs: 150 });
  await job;
  const reset = fake.log.find((e) => e.c === '\x18');
  assert.ok(reset, 'the reset still went out');
  assert.equal(reset.head, 'Run');
  assert.ok(reset.at - start >= 140, `waited ${reset.at - start} ms for the carriage first`);
  assert.ok(fake.log.filter((e) => e.c === '?' && e.at >= start).length >= 2, 'kept asking while it waited');
  grbl.close();
});
