/*
 * Runs scripts/calculations.js and checks the key figures that
 * docs/CALCULATIONS.md quotes from it. Several depend on other modules (the
 * reset job's time and magnet duty come from src/planner.js and the defaults
 * in src/gcode.js), so a change there that moves a number fails here instead
 * of leaving the document out of date. If the change is meant, rerun the
 * script, update the document, then update the figures below.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = (args = []) => spawnSync(process.execPath, ['scripts/calculations.js', ...args], { cwd: ROOT, encoding: 'utf8' });

// Each figure must appear, written the same way, in the script's output and in the document.
const FIGURES = [
  '9.9 N', // usable torque of the X motor, a 17HS4401 (section 3)
  '11.1 N', // usable torque of the Y motor, a 17HS15-1504S-X1
  '38.5%', // $111 as a fraction of the Y motor's rule-of-thumb roll-off speed (section 2)
  '281 rpm', // where the back-EMF check says Y's current stops keeping up
  '13600', // the king's tipping acceleration with no felt, the funded build (section 6)
  '11300', // the same with the optional felt
  '11500', // the same with no felt if the washer sits flush and the king stands on it
  '0.0118', // low estimate of the pull at the funded build's 3.4 mm gap (section 5)
  '0.268', // top of the range from other table points at 3.4 mm
  '0.0054', // low estimate of the pull at 4.4 mm, with the optional felt
  '0.143', // high estimate at 4.4 mm
  '0.203', // top of the range from other table points at 4.4 mm
  '0.161', // centred pull needed at mu = 0.3, s = 0.5 (section 7)
  '0.0100', // what holds the lightest standing piece (section 7)
  '19.9 mm', // closest a reset drag passes a standing piece
  '0.66 mm', // rod sag (section 8)
  '2200 mm', // belt used (section 9)
  '110.8 s', // reset job time (section 10)
  '71%', // magnet duty in the reset job
  '3.22 A', // supply current bound (section 11)
  '0.87 A', // supply current estimate from the energy balance
  '0.94 A', // what-if: windings 50 K above room temperature
  '0.95 A', // what-if: X coils at the 2.4 ohm the X listing's rated voltage implies
  '1.33 A', // what-if: each motor at its full torque, the most before it stalls
  '1.49 A', // what-if: the motors' share twice the estimate
  '35.6 W', // power the motors and drivers would need to reach the bound
  '0.56 A', // meter reading while homing (Milestone 2)
  '0.53 A', // meter reading with the motors enabled and still (Milestone 2)
  '0.81 A', // meter reading during a drag at F2000, magnet on (Milestone 3)
  '18.7 s', // homing time (section 12)
];

test('calculations.js prints the figures docs/CALCULATIONS.md quotes', () => {
  const { status, stdout, stderr } = run();
  assert.equal(status, 0, stderr);
  const doc = readFileSync(new URL('../docs/CALCULATIONS.md', import.meta.url), 'utf8');
  for (const figure of FIGURES) {
    assert.ok(stdout.includes(figure), `the script no longer prints ${figure}`);
    assert.ok(doc.includes(figure), `docs/CALCULATIONS.md no longer quotes ${figure}`);
  }
});

test('calculations.js stops when a directory option has no directory', () => {
  for (const flag of ['--stl-dir', '--export-stl']) {
    const { status, stderr } = run([flag]);
    assert.equal(status, 1, `${flag} with no value should fail`);
    assert.match(stderr, /needs a directory/);
  }
});
