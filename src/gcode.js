/*
 * Turns a plan into G-code for a GRBL-style XY gantry: a rapid move with the
 * magnet off to get under a piece, then feed moves with it on to drag it.
 * Coordinates are millimetres from the outer corner of the left storage area,
 * so square centers sit at (x + 0.5) * squareMm. offsetX/offsetY shift
 * everything to wherever that corner sits in the machine's coordinates
 * after homing (measure it once by jogging the magnet to a1 and h8).
 *
 * Or pass { calibration }, the object calibrate.js writes to
 * calibration.json: then every point goes through its offset, measured
 * square sizes and rotation (see src/calibration.js). Leave out offsetX and
 * offsetY, and squareMm if given must match it. A calibration belongs to one
 * board layout, so pass storageColumns too and toGcode checks they match.
 *
 * The job ends with the magnet parked. Without a calibration that is the
 * line "G0 X0 Y0", which ignores offsetX/offsetY. With a calibration X0 Y0
 * is machine zero, a corner of the travel set by homing (on the switch
 * trigger points with GRBL's default homing direction, $23=0), so the
 * magnet parks over a cell instead: park, in cell coordinates, which
 * defaults to cell (0, 0), the left storage column on rank 1. Every cell
 * center is inside the travel the calibration was measured in. A park
 * given without a calibration goes through offsetX/offsetY like the moves.
 *
 * The magnet defaults to M8/M9 (the coolant pin on a GRBL CNC shield, easy to
 * wire to a relay or MOSFET); change magnetOn/magnetOff to match the wiring.
 */
import { checkCalibration, toMachine } from './calibration.js';

function calibratedPosition(calibration, options) {
  checkCalibration(calibration);
  if (options.offsetX !== undefined || options.offsetY !== undefined) {
    throw new Error('Pass offsetX/offsetY or a calibration, not both: the calibration already holds the offset');
  }
  if (options.squareMm !== undefined && calibration.squareMm !== undefined && options.squareMm !== calibration.squareMm) {
    throw new Error(`squareMm ${options.squareMm} does not match the calibration, which was made for ${calibration.squareMm} mm squares`);
  }
  if (options.storageColumns !== undefined && calibration.storageColumns !== undefined && options.storageColumns !== calibration.storageColumns) {
    throw new Error(
      `The plan uses ${options.storageColumns} storage column(s) per side but the calibration was made for ${calibration.storageColumns}; ` +
        'every square would be off by a column',
    );
  }
  return (point) => toMachine(calibration, point.x, point.y);
}

export function toGcode(moves, options = {}) {
  const {
    squareMm = 50,
    dragFeed = 2000, // mm/min while a piece is on the magnet
    magnetOn = 'M8',
    magnetOff = 'M9',
    settleSeconds = 0.2, // pause so the piece grabs or settles before moving on
    offsetX = 0,
    offsetY = 0,
    calibration,
    park,
  } = options;
  if (park !== undefined && !(Number.isFinite(park?.x) && Number.isFinite(park?.y))) {
    throw new Error('park must be a cell { x, y }, for example { x: 0, y: 0 }');
  }
  const position = calibration
    ? calibratedPosition(calibration, options)
    : (point) => ({ x: (point.x + 0.5) * squareMm + offsetX, y: (point.y + 0.5) * squareMm + offsetY });
  const xy = (point) => {
    const { x, y } = position(point);
    return `X${x.toFixed(1)} Y${y.toFixed(1)}`;
  };
  const lines = ['; robotic chessboard plan', 'G21 ; millimetres', 'G90 ; absolute positions', magnetOff];
  moves.forEach((move, i) => {
    const [start, ...rest] = move.path;
    lines.push(`; ${i + 1}. ${move.piece} ${move.from} -> ${move.to} (${move.kind})`);
    lines.push(`G0 ${xy(start)}`);
    lines.push(magnetOn, `G4 P${settleSeconds}`);
    for (const point of rest) lines.push(`G1 ${xy(point)} F${dragFeed}`);
    lines.push(magnetOff, `G4 P${settleSeconds}`);
  });
  if (calibration || park) lines.push(`G0 ${xy(park ?? { x: 0, y: 0 })} ; park`);
  else lines.push('G0 X0 Y0 ; home');
  return `${lines.join('\n')}\n`;
}
