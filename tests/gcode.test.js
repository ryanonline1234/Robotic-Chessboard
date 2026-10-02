import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoard } from '../src/board.js';
import { solveCalibration, toMachine } from '../src/calibration.js';
import { toGcode } from '../src/gcode.js';
import { createGrbl } from '../src/grbl.js';
import { planArrangement } from '../src/planner.js';
import { scenario } from '../src/scenarios.js';
import { createFakeGrbl } from './fake-grbl.js';

const MOVES = [
  { piece: 'N', from: 'g1', to: 'f3', kind: 'direct', path: [{ x: 7, y: 0 }, { x: 6.5, y: 1 }, { x: 6, y: 2 }] },
  { piece: 'P', from: 'e2', to: 'e4', kind: 'direct', path: [{ x: 5, y: 1 }, { x: 5, y: 3 }] },
];

function planFor(storageColumns) {
  const board = createBoard({ storageColumns });
  const { from, to } = scenario(board, 'reset', 3);
  return planArrangement(board, from, to, { pieceDiameter: 0.475 });
}

test('without a calibration the output format is unchanged', () => {
  assert.equal(
    toGcode(MOVES, { squareMm: 40, offsetX: 12, offsetY: -3 }),
    [
      '; robotic chessboard plan',
      'G21 ; millimetres',
      'G90 ; absolute positions',
      'M9',
      '; 1. N g1 -> f3 (direct)',
      'G0 X312.0 Y17.0',
      'M8',
      'G4 P0.2',
      'G1 X292.0 Y57.0 F2000',
      'G1 X272.0 Y97.0 F2000',
      'M9',
      'G4 P0.2',
      '; 2. P e2 -> e4 (direct)',
      'G0 X232.0 Y57.0',
      'M8',
      'G4 P0.2',
      'G1 X232.0 Y137.0 F2000',
      'M9',
      'G4 P0.2',
      'G0 X0 Y0 ; home',
      '',
    ].join('\n'),
  );
});

test('a calibration with no rotation gives exactly the plain offset output', () => {
  const plan = planFor(1);
  const { calibration } = solveCalibration({ points: { a1: { x: 72, y: 17 }, h8: { x: 352, y: 297 } } });
  const exact = { ...calibration, offsetX: 12, offsetY: -3, squareX: 40, squareY: 40, rotationDeg: 0, skewDeg: 0 };
  // A calibrated job parks over cell (0, 0); the same park, given to the plain version, goes through its offsets.
  const plain = toGcode(plan.moves, { squareMm: 40, offsetX: 12, offsetY: -3, park: { x: 0, y: 0 } });
  assert.equal(toGcode(plan.moves, { calibration: exact, storageColumns: 1 }), plain);
  // The fitted numbers differ from the exact ones only in the last bits, which rounding to 0.1 mm hides.
  assert.equal(toGcode(plan.moves, { calibration }), plain);
});

test('a calibrated job parks over a cell, not at machine zero', () => {
  const calibration = { squareMm: 40, storageColumns: 1, offsetX: -368, offsetY: -300, squareX: 40, squareY: 40, rotationDeg: 0, skewDeg: 0 };
  const last = (gcode) => gcode.trimEnd().split('\n').at(-1);
  // Cell (0, 0), the left storage column on rank 1: 0.5 * 40 - 368, 0.5 * 40 - 300.
  assert.equal(last(toGcode(MOVES, { calibration })), 'G0 X-348.0 Y-280.0 ; park');
  // R1-8, the right storage column on rank 8, if asked for.
  assert.equal(last(toGcode(MOVES, { calibration, park: { x: 9, y: 7 } })), 'G0 X12.0 Y0.0 ; park');
  // Without a calibration or a park, the last line stays as it was.
  assert.equal(last(toGcode(MOVES, { squareMm: 40, offsetX: 12, offsetY: -3 })), 'G0 X0 Y0 ; home');
  assert.throws(() => toGcode(MOVES, { calibration, park: { x: 'a', y: 0 } }), /park must be a cell/);
});

test('every point goes through the calibration: rotation, scale and offset', () => {
  // Turned a quarter turn so the numbers can be checked by hand: files run
  // along machine +Y and ranks along machine -X.
  const quarter = { squareMm: 40, storageColumns: 1, offsetX: 100, offsetY: 50, squareX: 40, squareY: 40, rotationDeg: 90, skewDeg: 0 };
  const gcode = toGcode(MOVES, { calibration: quarter });
  // g1 is cell (7, 0): 7.5 squares along +Y and 0.5 squares along -X.
  assert.match(gcode, /^G0 X80\.0 Y350\.0$/m);
  // f3 is cell (6, 2): 6.5 squares along +Y and 2.5 squares along -X.
  assert.match(gcode, /^G1 X0\.0 Y310\.0 F2000$/m);

  const turned = { squareMm: 40, storageColumns: 1, offsetX: -371.2, offsetY: -298.45, squareX: 40.3, squareY: 39.8, rotationDeg: 0.8, skewDeg: -0.3 };
  const plan = planFor(1);
  const moves = toGcode(plan.moves, { calibration: turned })
    .split('\n')
    .filter((line) => /^G[01] X/.test(line))
    .slice(0, -1); // the last one is the park move
  const points = plan.moves.flatMap((move) => move.path.map((point, i) => ({ point, rapid: i === 0 })));
  assert.equal(moves.length, points.length);
  points.forEach(({ point, rapid }, i) => {
    const want = toMachine(turned, point.x, point.y);
    assert.ok(moves[i].startsWith(`G${rapid ? 0 : 1} X${want.x.toFixed(1)} Y${want.y.toFixed(1)}`), `${moves[i]} should be at ${want.x}, ${want.y}`);
  });
});

test('a calibration is refused when it does not fit the other options', () => {
  const calibration = { squareMm: 40, storageColumns: 1, offsetX: 0, offsetY: 0, squareX: 40, squareY: 40, rotationDeg: 0, skewDeg: 0 };
  assert.throws(() => toGcode(MOVES, { calibration, offsetX: 5 }), /not both/);
  assert.throws(() => toGcode(MOVES, { calibration, squareMm: 50 }), /40 mm squares/);
  assert.throws(() => toGcode(MOVES, { calibration, storageColumns: 2 }), /off by a column/);
  assert.throws(() => toGcode(MOVES, { calibration: { offsetX: 0 } }), /offsetY/);
  assert.doesNotThrow(() => toGcode(MOVES, { calibration, squareMm: 40, storageColumns: 1 }));
});

test('calibrated G-code streams cleanly to a fake GRBL', async () => {
  const plan = planFor(2);
  const { calibration } = solveCalibration({
    points: { a1: { x: -296.1, y: -281.3 }, h8: { x: -12.4, y: -0.9 } },
    squareMm: 40,
    storageColumns: 2,
  });
  const gcode = toGcode(plan.moves, { calibration, storageColumns: 2 });
  const fake = createFakeGrbl();
  const grbl = createGrbl(fake.port, { statusIntervalMs: 0, lineTimeoutMs: 200 });
  const result = await grbl.stream(gcode);
  assert.ok(result.lines > plan.moves.length * 4);
  assert.equal(fake.received.at(-1), 'G4 P0');
  grbl.close();
});
