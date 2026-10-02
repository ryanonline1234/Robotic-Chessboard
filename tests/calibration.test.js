import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoard } from '../src/board.js';
import { cellOf, checkCalibration, parsePoint, solveCalibration, toMachine } from '../src/calibration.js';

const close = (actual, expected, tolerance = 1e-9, label = '') => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} ${actual} should be ${expected}`);
};

// What the builder would read off the sender for a square, on a machine
// whose board really sits where `truth` says.
function measure(truth, names, storageColumns) {
  return Object.fromEntries(names.map((name) => {
    const cell = cellOf(name, storageColumns);
    return [name, toMachine(truth, cell.x, cell.y)];
  }));
}

test('positions are read from X,Y text, negative numbers included', () => {
  assert.deepEqual(parsePoint('60.5,20'), { x: 60.5, y: 20 });
  assert.deepEqual(parsePoint(' -345.25 , -280 '), { x: -345.25, y: -280 });
  for (const bad of ['60', '1,2,3', 'a,b', ',5', '', undefined]) assert.throws(() => parsePoint(bad), /X,Y/);
});

test('a1 and h8 sit where the planner thinks, for 1 and 2 storage columns', () => {
  assert.deepEqual([cellOf('a1', 1), cellOf('h8', 1)], [{ x: 1, y: 0 }, { x: 8, y: 7 }]);
  assert.deepEqual([cellOf('a1', 2), cellOf('h8', 2)], [{ x: 2, y: 0 }, { x: 9, y: 7 }]);
});

test('two points recover a known offset, square size and rotation', () => {
  const cases = [
    { storage: 1, truth: { offsetX: 12.5, offsetY: -3.25, squareX: 40, squareY: 40, rotationDeg: 0, skewDeg: 0 } },
    { storage: 1, truth: { offsetX: -371.2, offsetY: -298.45, squareX: 40.12, squareY: 40.12, rotationDeg: 0.73, skewDeg: 0 } },
    { storage: 1, truth: { offsetX: 30, offsetY: 41, squareX: 39.7, squareY: 39.7, rotationDeg: -1.6, skewDeg: 0 } },
    { storage: 2, truth: { offsetX: 5, offsetY: 8, squareX: 50.2, squareY: 50.2, rotationDeg: 0.4, skewDeg: 0 }, square: 50 },
  ];
  for (const { storage, truth, square = 40 } of cases) {
    const points = measure(truth, ['a1', 'h8'], storage);
    const { calibration, warnings } = solveCalibration({ points, squareMm: square, storageColumns: storage });
    for (const key of ['offsetX', 'offsetY', 'squareX', 'squareY', 'rotationDeg', 'skewDeg']) close(calibration[key], truth[key], 1e-9, key);
    assert.equal(calibration.storageColumns, storage);
    assert.deepEqual(warnings, []);
    // Every cell center lands where the true board has it.
    for (let x = 0; x < 8 + 2 * storage; x++) {
      for (let y = 0; y < 8; y++) {
        const want = toMachine(truth, x, y);
        const got = toMachine(calibration, x, y);
        close(got.x, want.x, 1e-9);
        close(got.y, want.y, 1e-9);
      }
    }
  }
});

test('an unrotated board at nominal size gives back the plain offsets', () => {
  const { calibration } = solveCalibration({ points: { a1: { x: 72, y: 17 }, h8: { x: 352, y: 297 } } });
  close(calibration.offsetX, 12);
  close(calibration.offsetY, -3);
  close(calibration.squareX, 40);
  close(calibration.rotationDeg, 0);
  // Same as toGcode's (x + 0.5) * squareMm + offset.
  const g2 = toMachine(calibration, 8, 1);
  close(g2.x, 352);
  close(g2.y, 57);
});

test('three or four points recover square size per axis, rotation and skew', () => {
  const truth = { offsetX: -360.4, offsetY: 12.75, squareX: 40.3, squareY: 39.6, rotationDeg: -1.2, skewDeg: 0.6 };
  for (const names of [['a1', 'h8', 'h1'], ['a1', 'h8', 'a8'], ['a1', 'h8', 'h1', 'a8']]) {
    const { calibration } = solveCalibration({ points: measure(truth, names, 1) });
    for (const key of ['offsetX', 'offsetY', 'squareX', 'squareY', 'rotationDeg', 'skewDeg']) close(calibration[key], truth[key], 1e-9, `${names} ${key}`);
    close(calibration.maxErrorMm, 0, 1e-9);
    assert.match(calibration.method, new RegExp(`^${names.length} points`));
  }
});

test('two points are exact at a1 and h8 even when the axes really differ', () => {
  // The limit of a two-point fit: it can't see different square sizes per
  // axis, but it still puts a1 and h8 exactly where they were measured.
  const truth = { offsetX: 10, offsetY: 10, squareX: 40.3, squareY: 39.7, rotationDeg: 0, skewDeg: 0 };
  const points = measure(truth, ['a1', 'h8'], 1);
  const { calibration } = solveCalibration({ points });
  for (const name of ['a1', 'h8']) {
    const cell = cellOf(name, 1);
    const got = toMachine(calibration, cell.x, cell.y);
    close(got.x, points[name].x);
    close(got.y, points[name].y);
  }
  close(calibration.squareX, calibration.squareY);
});

test('four points that disagree are reported', () => {
  const truth = { offsetX: 0, offsetY: 0, squareX: 40, squareY: 40, rotationDeg: 0, skewDeg: 0 };
  const points = measure(truth, ['a1', 'h8', 'h1', 'a8'], 1);
  points.a8 = { x: points.a8.x + 5, y: points.a8.y };
  const { calibration, warnings } = solveCalibration({ points });
  // A least-squares fit spreads the 5 mm over the four corners.
  close(calibration.maxErrorMm, 1.25, 1e-9);
  assert.ok(warnings.some((w) => /disagree/.test(w)));
});

test('measurements that cannot be right are refused', () => {
  const nominal = { offsetX: 0, offsetY: 0, squareX: 40, squareY: 40, rotationDeg: 0, skewDeg: 0 };
  const good = measure(nominal, ['a1', 'h8', 'h1'], 1);
  // Y running from rank 8 to rank 1: a mirror image.
  const flipped = Object.fromEntries(Object.entries(good).map(([name, p]) => [name, { x: p.x, y: -p.y }]));
  assert.throws(() => solveCalibration({ points: flipped }), /mirrored/);
  assert.throws(() => solveCalibration({ points: { a1: flipped.a1, h8: flipped.h8 } }), /turned/);
  // Steps per mm set for 1/16 microstepping on drivers jumpered for 1/8: the board looks half size.
  assert.throws(() => solveCalibration({ points: { a1: { x: 30, y: 10 }, h8: { x: 170, y: 150 } } }), /\$100/);
  assert.throws(() => solveCalibration({ points: { a1: { x: 60, y: 20 }, h8: { x: 61, y: 20 } } }), /same place/);
  assert.throws(() => solveCalibration({ points: { a1: { x: 60, y: 20 } } }), /at least two/);
  assert.throws(() => solveCalibration({ points: { a1: good.a1, h8: good.h8, z9: good.h1 } }), /Unknown cell/);
});

test('a board a little off gets warnings, not errors', () => {
  const stretched = solveCalibration({ points: measure({ offsetX: 0, offsetY: 0, squareX: 41.2, squareY: 41.2, rotationDeg: 0, skewDeg: 0 }, ['a1', 'h8'], 1) });
  // Two points give one size for both axes, so it is reported once.
  assert.equal(stretched.warnings.filter((w) => /3\.0% more/.test(w)).length, 1);
  const turned = solveCalibration({ points: measure({ offsetX: 0, offsetY: 0, squareX: 40, squareY: 40, rotationDeg: 3, skewDeg: 0 }, ['a1', 'h8'], 1) });
  assert.ok(turned.warnings.some((w) => /turned 3\.00 degrees/.test(w)));
  const skewed = solveCalibration({ points: measure({ offsetX: 0, offsetY: 0, squareX: 40, squareY: 40, rotationDeg: 0, skewDeg: 1.5 }, ['a1', 'h8', 'h1'], 1) });
  assert.ok(skewed.warnings.some((w) => /1\.50 degrees out of square/.test(w)));
  // A warning asks for a check; it doesn't promise the fit has fixed the problem.
  for (const w of [...stretched.warnings, ...turned.warnings, ...skewed.warnings]) assert.doesNotMatch(w, /corrects for it/);
});

test('a jog to the wrong square is refused, whichever corner it was', () => {
  const nominal = { offsetX: -368, offsetY: -300, squareX: 40, squareY: 40, rotationDeg: 0, skewDeg: 0 };
  const board = createBoard({ storageColumns: 1 });
  let tried = 0;
  for (const names of [['a1', 'h8'], ['a1', 'h8', 'h1'], ['a1', 'h8', 'h1', 'a8']]) {
    for (const wrong of names) {
      const cell = cellOf(wrong, 1);
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        if (x < 0 || x >= board.width || y < 0 || y >= board.height) continue;
        const points = measure(nominal, names, 1);
        points[wrong] = toMachine(nominal, x, y);
        assert.throws(() => solveCalibration({ points }), /jogging to the wrong square/, `${wrong} jogged ${dx},${dy} off, measuring ${names}`);
        tried++;
      }
    }
  }
  assert.equal(tried, 45); // 9 measured corners, 5 neighbors each

  // The reviewer's case: h1 jogged one square too high (to h2).
  const h1High = { a1: { x: -308, y: -280 }, h8: { x: -28, y: 0 }, h1: { x: -28, y: -240 } };
  assert.throws(() => solveCalibration({ points: h1High }), (err) => {
    assert.match(err.message, /ranks the squares measure 34\.29 mm, 14\.3% less/);
    assert.match(err.message, /8\.13 degrees out of square, more than the 2-degree limit/);
    assert.match(err.message, /--force/);
    return true;
  });
});

test('force turns the limits into warnings; a mirrored board is still refused', () => {
  const h1High = { a1: { x: -308, y: -280 }, h8: { x: -28, y: 0 }, h1: { x: -28, y: -240 } };
  const { calibration, warnings } = solveCalibration({ points: h1High, force: true });
  assert.equal(calibration.forced, true);
  assert.ok(warnings.some((w) => /^Forced past a limit: The gantry is -8\.13 degrees out of square/.test(w)));
  const fine = solveCalibration({ points: { a1: { x: -308, y: -280 }, h8: { x: -28, y: 0 } }, force: true });
  assert.equal(fine.calibration.forced, undefined, 'only marked when a limit was passed');
  const mirrored = { a1: { x: 60, y: -20 }, h8: { x: 340, y: -300 }, h1: { x: 340, y: -20 } };
  assert.throws(() => solveCalibration({ points: mirrored, force: true }), /mirrored/);
});

test('checkCalibration rejects incomplete objects', () => {
  assert.throws(() => checkCalibration(null), /object/);
  assert.throws(() => checkCalibration({ offsetX: 0, offsetY: 0, squareX: 40 }), /squareY/);
  assert.throws(() => checkCalibration({ offsetX: 0, offsetY: 0, squareX: 40, squareY: 40, rotationDeg: 'x' }), /rotationDeg/);
  assert.throws(() => checkCalibration({ offsetX: 0, offsetY: 0, squareX: 40, squareY: -1 }), /zero or less/);
  assert.ok(checkCalibration({ offsetX: 0, offsetY: 0, squareX: 40, squareY: 40 }));
});
