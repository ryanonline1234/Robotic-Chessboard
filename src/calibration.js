/*
 * Works out where the board sits under the gantry, from the machine
 * positions the builder measured by jogging the magnet to the centers of a
 * few squares (always a1 and h8; h1 and a8 are optional extras).
 *
 * The result maps a cell (x, y) on the planner's grid (x from the left
 * storage column, y from rank 1, centers on whole numbers) to machine
 * millimetres:
 *
 *   machine = offset + (x + 0.5) * squareX * fileDir + (y + 0.5) * squareY * rankDir
 *
 * where offset is the machine position of the board's outer corner (left
 * storage column, rank-1 edge), fileDir is a unit vector turned rotationDeg
 * counterclockwise from machine +X, and rankDir is 90 + skewDeg degrees
 * further round. With no rotation or skew and squareX = squareY = the
 * nominal square, this is exactly what toGcode does with offsetX/offsetY.
 *
 * Two points can't tell a board that is slightly turned from one whose axes
 * are slightly stretched by different amounts: both move h8 the same way.
 * So with only a1 and h8 the fit assumes one square size for both axes and
 * solves for the rotation. Add h1 (and a8) to measure each axis separately
 * and how far the gantry is out of square; with four points it is a
 * least-squares fit and reports how well the points agree.
 */
import { cellAt, cellX, cellY, createBoard, parseCell } from './board.js';

const DEG = Math.PI / 180;

// Reads "X,Y" (millimetres) into { x, y }.
export function parsePoint(text) {
  const parts = String(text ?? '').split(',').map((part) => part.trim());
  const [x, y] = parts.map(Number);
  if (parts.length !== 2 || parts.some((part) => part === '') || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`"${text}" is not a position: give X,Y in millimetres, for example 60.5,-20`);
  }
  return { x, y };
}

// Grid cell { x, y } of a square name such as a1 or h8.
export function cellOf(name, storageColumns = 1) {
  const board = createBoard({ storageColumns });
  const cell = parseCell(board, name);
  return { x: cellX(board, cell), y: cellY(board, cell) };
}

// Cosine and sine of an angle in degrees, exact at multiples of 90 so an
// unrotated calibration gives exactly the same numbers as plain offsets.
function cosDeg(deg) {
  const turn = ((deg % 360) + 360) % 360;
  if (turn === 0) return 1;
  if (turn === 180) return -1;
  if (turn === 90 || turn === 270) return 0;
  return Math.cos(deg * DEG);
}
const sinDeg = (deg) => cosDeg(deg - 90);

// Machine position of a cell center; x and y may be fractions (routes run
// along half squares).
export function toMachine(calibration, x, y) {
  const { offsetX, offsetY, squareX, squareY, rotationDeg = 0, skewDeg = 0 } = calibration;
  const rankDeg = rotationDeg + 90 + skewDeg;
  const along = (x + 0.5) * squareX;
  const up = (y + 0.5) * squareY;
  return {
    x: offsetX + along * cosDeg(rotationDeg) + up * cosDeg(rankDeg),
    y: offsetY + along * sinDeg(rotationDeg) + up * sinDeg(rankDeg),
  };
}

// Throws unless the object has everything toMachine needs.
export function checkCalibration(calibration) {
  if (!calibration || typeof calibration !== 'object') throw new Error('The calibration must be an object (the contents of calibration.json)');
  for (const key of ['offsetX', 'offsetY', 'squareX', 'squareY']) {
    if (!Number.isFinite(calibration[key])) throw new Error(`The calibration has no valid ${key}`);
  }
  for (const key of ['rotationDeg', 'skewDeg']) {
    if (calibration[key] !== undefined && !Number.isFinite(calibration[key])) throw new Error(`The calibration's ${key} is not a number`);
  }
  if (calibration.squareX <= 0 || calibration.squareY <= 0) throw new Error('The calibration has a square size of zero or less');
  if (calibration.storageColumns !== undefined && !(Number.isInteger(calibration.storageColumns) && calibration.storageColumns >= 1)) {
    throw new Error('The calibration\'s storageColumns must be a positive whole number');
  }
  return calibration;
}

function wrapDegrees(deg) {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

// Solves the 3x3 system m * v = b (Cramer's rule).
function solve3(m, b) {
  const det = (a) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  if (Math.abs(d) < 1e-9) return null;
  return [0, 1, 2].map((col) => det(m.map((row, r) => row.map((v, c) => (c === col ? b[r] : v)))) / d);
}

// Two points: one square size for both axes, a rotation and an offset.
function fitTwo(cells, measured) {
  const run = { x: cells[1].x - cells[0].x, y: cells[1].y - cells[0].y };
  const seen = { x: measured[1].x - measured[0].x, y: measured[1].y - measured[0].y };
  const square = Math.hypot(seen.x, seen.y) / Math.hypot(run.x, run.y);
  const rotationDeg = wrapDegrees((Math.atan2(seen.y, seen.x) - Math.atan2(run.y, run.x)) / DEG);
  const unit = { offsetX: 0, offsetY: 0, squareX: square, squareY: square, rotationDeg, skewDeg: 0 };
  const first = toMachine(unit, cells[0].x, cells[0].y);
  return { ...unit, offsetX: measured[0].x - first.x, offsetY: measured[0].y - first.y };
}

// Three or more points: a least-squares affine fit, machine = J * (cell + 0.5) + offset.
function fitAffine(cells, measured) {
  const rows = cells.map((c) => [c.x + 0.5, c.y + 0.5, 1]);
  const normal = [0, 1, 2].map((i) => [0, 1, 2].map((j) => rows.reduce((sum, r) => sum + r[i] * r[j], 0)));
  const rhs = (axis) => [0, 1, 2].map((i) => rows.reduce((sum, r, k) => sum + r[i] * measured[k][axis], 0));
  const fx = solve3(normal, rhs('x'));
  const fy = solve3(normal, rhs('y'));
  if (!fx || !fy) throw new Error('The measured squares lie on one line; use corners such as a1, h8 and h1');
  const file = { x: fx[0], y: fy[0] }; // machine step for one file to the right
  const rank = { x: fx[1], y: fy[1] }; // machine step for one rank up
  if (file.x * rank.y - file.y * rank.x <= 0) {
    throw new Error('The board comes out mirrored: one machine axis runs the wrong way. Make +X run from file a to h and +Y from rank 1 to 8 (GRBL setting $3 reverses an axis), then measure again.');
  }
  const rotationDeg = Math.atan2(file.y, file.x) / DEG;
  const skewDeg = wrapDegrees(Math.atan2(rank.y, rank.x) / DEG - rotationDeg - 90);
  return {
    offsetX: fx[2],
    offsetY: fy[2],
    squareX: Math.hypot(file.x, file.y),
    squareY: Math.hypot(rank.x, rank.y),
    rotationDeg,
    skewDeg,
  };
}


/*
 * How far a fit may be from the nominal board. Up to `warn` it is used
 * quietly; past `warn` it is used with a warning; past `refuse` it is
 * refused unless forced. A jog to the wrong square moves a corner a whole
 * square, which comes out as about 7% or more on the square size or 4
 * degrees or more of skew; tests/calibration.test.js tries every such
 * mistake on a nominal board and checks each one is refused. The limits
 * themselves are judgments: a built gantry should be well inside them.
 */
export const CALIBRATION_LIMITS = {
  squarePercent: { warn: 2, refuse: 5 }, // each axis's square size against the nominal size
  axisDifferencePercent: { refuse: 3 }, // file squares against rank squares (three or more points)
  rotationDeg: { warn: 2, refuse: 5 },
  skewDeg: { warn: 1, refuse: 2 }, // out of square (three or more points)
  disagreementMm: { warn: 1, refuse: 5 }, // worst point against the fit (four or more points)
};

/*
 * points: { a1: { x, y }, h8: { x, y }, h1?: ..., a8?: ... } in machine mm
 * (any play squares work; at least two). Returns { calibration, warnings }.
 * Throws when the measurements can't be right: mirrored axes, or anything
 * past the CALIBRATION_LIMITS refuse values. With force: true the limits
 * become warnings, for a board that really is that far out.
 */
export function solveCalibration({ points, squareMm = 40, storageColumns = 1, force = false }) {
  const names = Object.keys(points ?? {});
  if (names.length < 2) throw new Error('Measure at least two squares (a1 and h8)');
  const cells = names.map((name) => cellOf(name, storageColumns));
  const measured = names.map((name) => points[name]);
  const board = createBoard({ storageColumns });
  if (new Set(cells.map((c) => cellAt(board, c.x, c.y))).size !== cells.length) throw new Error('Each square can only be measured once');
  for (let i = 1; i < measured.length; i++) {
    if (Math.hypot(measured[i].x - measured[0].x, measured[i].y - measured[0].y) < squareMm / 2) {
      throw new Error(`${names[0]} and ${names[i]} were measured at almost the same place`);
    }
  }

  const twoPoints = names.length === 2;
  const fit = twoPoints ? fitTwo(cells, measured) : fitAffine(cells, measured);
  const calibration = {
    squareMm,
    storageColumns,
    ...fit,
    method: twoPoints
      ? `two points (${names.join(', ')}): one square size for both axes, plus rotation`
      : `${names.length} points (${names.join(', ')}): square size per axis, rotation and skew`,
    measured: Object.fromEntries(names.map((name) => [name, [points[name].x, points[name].y]])),
    maxErrorMm: Math.max(...cells.map((c, i) => {
      const p = toMachine(fit, c.x, c.y);
      return Math.hypot(p.x - measured[i].x, p.y - measured[i].y);
    })),
  };

  const limits = CALIBRATION_LIMITS;
  const problems = []; // past a refuse limit
  const warnings = [];
  const kinds = new Set();
  const judge = (kind, value, limit, unit, describe, advice) => {
    if (Math.abs(value) > limit.refuse) {
      problems.push(`${describe()}, more than the ${limit.refuse}${unit} limit`);
      kinds.add(kind);
    } else if (limit.warn !== undefined && Math.abs(value) > limit.warn) {
      warnings.push(`${describe()}. ${advice}`);
    }
  };

  // Two points give one square size for both axes, so it is judged once.
  const axes = twoPoints ? [['The squares', fit.squareX]] : [['Along the files the squares', fit.squareX], ['Along the ranks the squares', fit.squareY]];
  for (const [where, size] of axes) {
    const percent = (size / squareMm - 1) * 100;
    judge(
      'scale',
      percent,
      limits.squarePercent,
      '%',
      () => `${where} measure ${size.toFixed(2)} mm, ${Math.abs(percent).toFixed(1)}% ${percent > 0 ? 'more' : 'less'} than ${squareMm}`,
      'That is more than a built gantry should be off by: check the steps per mm ($100/$101), belt tension, that the board was printed at 100%, ' +
        'and that you jogged to the right squares. The fit uses the size as measured.',
    );
  }
  if (!twoPoints) {
    const difference = (fit.squareX / fit.squareY - 1) * 100;
    judge(
      'scale',
      difference,
      limits.axisDifferencePercent,
      '%',
      () => `The squares along the files (${fit.squareX.toFixed(2)} mm) and the ranks (${fit.squareY.toFixed(2)} mm) differ by ${Math.abs(difference).toFixed(1)}%`,
    );
  }
  judge(
    'rotation',
    fit.rotationDeg,
    limits.rotationDeg,
    '-degree',
    () => `The board is turned ${fit.rotationDeg.toFixed(2)} degrees on the gantry`,
    'Straighten the board top if you can, and check you jogged to the right squares. The fit uses the rotation as measured.',
  );
  if (!twoPoints) {
    judge(
      'skew',
      fit.skewDeg,
      limits.skewDeg,
      '-degree',
      () => `The gantry is ${fit.skewDeg.toFixed(2)} degrees out of square`,
      'Square up the frame if you can, and check you jogged to the right squares. The fit uses the skew as measured.',
    );
  }
  if (names.length > 3) {
    judge(
      'disagreement',
      calibration.maxErrorMm,
      limits.disagreementMm,
      ' mm',
      () => `The measured squares disagree by up to ${calibration.maxErrorMm.toFixed(1)} mm with any straight, evenly spaced grid`,
      'Measure them again.',
    );
  }

  if (problems.length > 0 && !force) {
    const hints = [
      'The usual cause is jogging to the wrong square: a1 is the corner square at White\'s left hand, h1 at White\'s right, and a8 and h8 the far corners on the left and right. ' +
        'Check each one and measure again.',
    ];
    const checks = [];
    if (kinds.has('scale')) {
      checks.push('check the steps per mm ($100/$101: 80 for a 20-tooth GT2 pulley at 1/16 microstepping, 40 at 1/8) and that the board was printed at 100%');
    }
    if (kinds.has('skew')) checks.push('square up the frame');
    if (checks.length > 0) hints.push(`If the squares were right, ${checks.join(', and ')}.`);
    if (kinds.has('rotation') && Math.abs(fit.rotationDeg) > 20) {
      hints.push('A turn this large usually means an axis runs the wrong way: +X must run from file a to h and +Y from rank 1 to 8 (GRBL setting $3 reverses an axis).');
    }
    hints.push('If you have checked and the board really is like this, calibrate.js --force uses the fit anyway.');
    throw new Error(`These measurements don't fit a ${squareMm} mm board:\n${problems.map((p) => `  - ${p}`).join('\n')}\n${hints.join('\n')}`);
  }
  if (problems.length > 0) {
    calibration.forced = true;
    warnings.unshift(...problems.map((p) => `Forced past a limit: ${p}. Check the squares and the build before trusting this fit.`));
  }
  return { calibration, warnings };
}
