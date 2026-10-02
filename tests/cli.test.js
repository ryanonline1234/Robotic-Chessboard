import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Runs the command-line tools as a builder would. send.js is only run with
// --dry-run or bad arguments, which never load the serialport package; its
// steps on a real port are tested in send-job.test.js.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = (script, args) => spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8' });

test('calibrate.js writes calibration.json that demo.js uses for its G-code', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'chessboard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'calibration.json');

  // Negative positions, as GRBL reports after homing toward the switches.
  const fit = run('calibrate.js', ['--a1', '-308,-280', '--h8', '-28,0', '--out', file]);
  assert.equal(fit.status, 0, fit.stderr);
  assert.match(fit.stdout, /Board corner \(offsetX, offsetY\)\s+-368\.000, -300\.000 mm/);
  assert.match(fit.stdout, /Two points cannot tell/);
  const calibration = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(calibration.offsetX, -368);
  assert.equal(calibration.squareX, 40);
  assert.equal(calibration.storageColumns, 1);

  const gcodeFile = join(dir, 'reset.gcode');
  const demo = run('demo.js', ['nf3', '--size', '0.475', '--calibration', file, '--gcode', gcodeFile]);
  assert.equal(demo.status, 0, demo.stderr);
  // g1 on a one-storage-column board is cell (7, 0): 7.5 * 40 - 368, 0.5 * 40 - 300.
  assert.match(readFileSync(gcodeFile, 'utf8'), /^G0 X-68\.0 Y-280\.0$/m);

  const clash = run('demo.js', ['nf3', '--storage', '2', '--calibration', file, '--gcode', gcodeFile]);
  assert.equal(clash.status, 2);
  assert.match(clash.stderr, /--storage 2 does not match/);

  // A --calibration left without its file must not fall back to uncalibrated G-code.
  const uncalibrated = join(dir, 'uncalibrated.gcode');
  const trailing = run('demo.js', ['reset', '--size', '0.475', '--gcode', uncalibrated, '--calibration']);
  assert.equal(trailing.status, 2);
  assert.match(trailing.stderr, /--calibration needs a value/);
  assert.equal(existsSync(uncalibrated), false);
  const swallowed = run('demo.js', ['reset', '--gcode', '--size', '0.475']);
  assert.equal(swallowed.status, 2);
  assert.match(swallowed.stderr, /--gcode needs a value/);
});

test('calibrate.js refuses a jog to the wrong square unless forced', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'chessboard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'calibration.json');
  // h1 jogged one square too high, to h2.
  const misjog = ['--a1', '-308,-280', '--h8', '-28,0', '--h1', '-28,-240', '--out', file];
  const refused = run('calibrate.js', misjog);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /jogging to the wrong square/);
  assert.match(refused.stderr, /8\.13 degrees out of square/);
  assert.equal(existsSync(file), false, 'nothing written');
  const forced = run('calibrate.js', [...misjog, '--force']);
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /Warning: Forced past a limit/);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).forced, true);
});

test('calibrate.js explains bad input', () => {
  const missing = run('calibrate.js', ['--a1', '60,20']);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--a1 and --h8/);
  const typo = run('calibrate.js', ['--a1', '60,20', '--h8', '340,300', '--sqare', '40']);
  assert.equal(typo.status, 2);
  assert.match(typo.stderr, /Unknown argument "--sqare"/);
  const wrong = run('calibrate.js', ['--a1', '60,20', '--h8', '200,160', '--out', join(tmpdir(), 'never-written.json')]);
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /steps per mm/);
});

test('send.js --dry-run shows what would be sent without opening a port', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'chessboard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'plan.gcode');
  writeFileSync(file, '; robotic chessboard plan\nG21 ; millimetres\n\n; 1. N g1 -> f3 (direct)\nG0 X300.0 Y20.0\nM8\n');
  const dry = run('send.js', [file, '--home', '--dry-run']);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /3 lines to send \(3 comment or blank lines left out\)/);
  assert.match(dry.stdout, /\$H/);
  assert.match(dry.stdout, /; 1\. N g1 -> f3 \(direct\)\n\s*2 {2}G0 X300\.0 Y20\.0/);
  assert.match(dry.stdout, /G4 P0/);

  const typo = run('send.js', [file, '--dryrun']);
  assert.equal(typo.status, 2, 'a mistyped --dry-run must not send for real');
  assert.match(typo.stderr, /Unknown option "--dryrun"/);
  const noPort = run('send.js', [file]);
  assert.equal(noPort.status, 2);
  assert.match(noPort.stderr, /--port/);
  const both = run('send.js', [file, '--home', '--no-home', '--dry-run']);
  assert.equal(both.status, 2);
  assert.match(both.stderr, /--home or --no-home, not both/);
});
