/*
 * Fits the board to the gantry and writes calibration.json, which
 * toGcode and demo.js use to put every move on the real squares.
 *
 *   node calibrate.js --a1 X,Y --h8 X,Y [--h1 X,Y] [--a8 X,Y]
 *                     [--square 40] [--storage 1] [--out calibration.json] [--force]
 *
 * Measuring: home the machine, put a piece over the magnet, switch the
 * magnet on (M8) and jog until the piece sits in the middle of a1. Note the
 * X and Y your G-code sender shows, then do the same for h8. Use the work
 * position (WPos); it is the same as the machine position (MPos) unless a
 * work offset was set with G10 or G92.
 *
 * With a1 and h8 alone the fit assumes the same square size on both axes
 * and solves for the board's rotation. Measure h1 as well (and a8) to get
 * each axis's square size and how far the gantry is out of square.
 *
 * A fit far from the nominal board (src/calibration.js, CALIBRATION_LIMITS)
 * is refused: it almost always means a jog to the wrong square. --force
 * writes it anyway, for a board that has been checked and really is that
 * far out.
 */
import { writeFileSync } from 'node:fs';
import process from 'node:process';

import { cellAt, cellName, createBoard } from './src/board.js';
import { parsePoint, solveCalibration, toMachine } from './src/calibration.js';

const VALUE_FLAGS = ['--a1', '--h8', '--h1', '--a8', '--square', '--storage', '--out'];
const SWITCHES = ['--force'];
const USAGE = 'Usage: node calibrate.js --a1 X,Y --h8 X,Y [--h1 X,Y] [--a8 X,Y] [--square 40] [--storage 1] [--out calibration.json] [--force]';

function fail(message) {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(2);
}

const args = process.argv.slice(2);
const given = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help' || args[i] === '-h') {
    console.log(USAGE);
    console.log('\nJog the magnet to the center of each square after homing and give its X,Y in millimetres.');
    process.exit(0);
  }
  if (SWITCHES.includes(args[i])) {
    given[args[i]] = true;
    continue;
  }
  if (!VALUE_FLAGS.includes(args[i])) fail(`Unknown argument "${args[i]}".`);
  if (i + 1 >= args.length) fail(`${args[i]} needs a value.`);
  given[args[i]] = args[++i]; // values may start with '-' (negative positions)
}
if (!given['--a1'] || !given['--h8']) fail('Give at least --a1 and --h8.');

const squareMm = Number(given['--square'] ?? 40);
const storageColumns = Number(given['--storage'] ?? 1);
if (!(squareMm > 0)) fail('--square must be a size in millimetres, for example 40.');
if (!Number.isInteger(storageColumns) || storageColumns < 1) fail('--storage must be 1 or more.');
const out = given['--out'] ?? 'calibration.json';

const points = {};
for (const name of ['a1', 'h8', 'h1', 'a8']) {
  if (given[`--${name}`] === undefined) continue;
  try {
    points[name] = parsePoint(given[`--${name}`]);
  } catch (err) {
    fail(`--${name}: ${err.message}`);
  }
}

let result;
try {
  result = solveCalibration({ points, squareMm, storageColumns, force: Boolean(given['--force']) });
} catch (err) {
  console.error(`Can't calibrate: ${err.message}`);
  process.exit(1);
}
const { calibration: fit, warnings } = result;

const round = (value, digits) => Number(value.toFixed(digits));
const calibration = {
  about: 'Written by calibrate.js. Cell (x, y) is at offset + (x + 0.5) * squareX along the files + (y + 0.5) * squareY along the ranks; the files run rotationDeg counterclockwise from machine +X, the ranks 90 + skewDeg further.',
  squareMm,
  storageColumns,
  offsetX: round(fit.offsetX, 3),
  offsetY: round(fit.offsetY, 3),
  squareX: round(fit.squareX, 4),
  squareY: round(fit.squareY, 4),
  rotationDeg: round(fit.rotationDeg, 4),
  skewDeg: round(fit.skewDeg, 4),
  method: fit.method,
  measured: fit.measured,
  maxErrorMm: round(fit.maxErrorMm, 3),
  ...(fit.forced ? { forced: true } : {}),
};

const mm = (value, digits = 1) => `${value >= 0 ? ' ' : ''}${value.toFixed(digits)}`;
const percent = (size) => {
  const p = (size / squareMm - 1) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`;
};
const twoPoints = Object.keys(points).length === 2;

console.log(`Board: ${squareMm} mm squares, ${storageColumns} storage column${storageColumns === 1 ? '' : 's'} on each side.`);
console.log(`Fit from ${calibration.method}.\n`);
console.log(`  Board corner (offsetX, offsetY)  ${calibration.offsetX.toFixed(3)}, ${calibration.offsetY.toFixed(3)} mm`);
if (twoPoints) {
  console.log(`  Square size                      ${calibration.squareX.toFixed(3)} mm on both axes (${percent(calibration.squareX)})`);
} else {
  console.log(`  Square size along the files      ${calibration.squareX.toFixed(3)} mm (${percent(calibration.squareX)})`);
  console.log(`  Square size along the ranks      ${calibration.squareY.toFixed(3)} mm (${percent(calibration.squareY)})`);
}
console.log(`  Rotation                         ${calibration.rotationDeg >= 0 ? '+' : ''}${calibration.rotationDeg.toFixed(3)} degrees (counterclockwise seen from above)`);
console.log(`  Out of square                    ${twoPoints ? 'not measured (add --h1)' : `${calibration.skewDeg >= 0 ? '+' : ''}${calibration.skewDeg.toFixed(3)} degrees`}`);
if (Object.keys(points).length > 3) console.log(`  Worst disagreement               ${calibration.maxErrorMm.toFixed(2)} mm between the measured squares and the fit`);

const board = createBoard({ storageColumns });
const corners = [
  [0, 7], [storageColumns, 7], [storageColumns + 7, 7], [board.width - 1, 7],
  [0, 0], [storageColumns, 0], [storageColumns + 7, 0], [board.width - 1, 0],
];
console.log('\nMachine positions of the corner cells:');
for (const [x, y] of corners) {
  const p = toMachine(calibration, x, y);
  console.log(`  ${cellName(board, cellAt(board, x, y)).padEnd(5)} X${mm(p.x).padStart(8)}  Y${mm(p.y).padStart(8)}`);
}

const all = [];
for (let x = 0; x < board.width; x++) for (let y = 0; y < board.height; y++) all.push(toMachine(calibration, x, y));
const span = (axis) => [Math.min(...all.map((p) => p[axis])), Math.max(...all.map((p) => p[axis]))];
const [minX, maxX] = span('x');
const [minY, maxY] = span('y');
console.log(`\nThe magnet must reach X ${minX.toFixed(1)} to ${maxX.toFixed(1)} and Y ${minY.toFixed(1)} to ${maxY.toFixed(1)} mm (every cell center).`);
console.log('With soft limits on ($20=1), that range must lie inside the travel set by $130 and $131.');

if (twoPoints) {
  console.log('\nTwo points cannot tell a slightly turned board from slightly different square sizes on each axis.');
  console.log('To measure both, also jog to h1 and add --h1 X,Y (and --a8 X,Y to check the fit).');
}
for (const warning of warnings) console.log(`\nWarning: ${warning}`);

writeFileSync(out, `${JSON.stringify(calibration, null, 2)}\n`);
console.log(`\nWrote ${out}. Use it with:`);
console.log(`  node demo.js reset --size 0.475 --calibration ${out} --gcode reset.gcode`);
