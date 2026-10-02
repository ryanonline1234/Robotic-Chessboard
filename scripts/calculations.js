/*
 * Engineering calculations for the v1 board: steps per mm, speeds, motor
 * torque, piece mass and balance, magnet pull and grip, tipping, rod sag, belt
 * length, the reset job's time and magnet duty, power and magnet heat.
 * docs/CALCULATIONS.md explains each one; every number in it is printed here.
 *
 * Inputs are tagged where they are defined:
 *   [design]      fixed by the v1 design (docs/DESIGN.md, docs/BOM.md)
 *   [source]      taken from a datasheet, listing or the GRBL source (the doc names it)
 *   [assumption]  an estimate, to be measured during the build
 *
 *   node scripts/calculations.js                   use the piece geometry recorded below
 *   node scripts/calculations.js --stl-dir DIR     measure it from pawn.stl ... king.stl in DIR
 *   node scripts/calculations.js --export-stl DIR  export those STLs with OpenSCAD first
 *                                                  (set OPENSCAD=/path/to/openscad if needed)
 *
 * tests/calculations.test.js runs this script and checks the key figures the
 * document quotes, so a change elsewhere (src/gcode.js defaults, the planner)
 * that moves one of them fails the tests instead of leaving the document stale.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { cellX, cellY, createBoard, parseCell, toArrangement } from '../src/board.js';
import { toGcode } from '../src/gcode.js';
import { pointSegmentDistance } from '../src/motion.js';
import { planArrangement } from '../src/planner.js';
import { scenario } from '../src/scenarios.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const G = 9.81; // m/s^2

// ---------------------------------------------------------------- inputs

const MOTION = {
  fullStepsPerRev: 200, // [source] 1.8 degree motors (both motor listings)
  beltPitch: 2, // mm [design] GT2
  pulleyTeeth: 20, // [design]
  microsteps: 16, // [design] A4988 with all three jumpers in
  stepRateLimit: 30000, // Hz [source] GRBL 1.1 README, Uno (ATmega328p)
  maxRate: 6000, // mm/min [design] $110/$111 in docs/DESIGN.md
  accel: 400, // mm/s^2 [design] $120/$121 in docs/DESIGN.md
  junctionDeviation: 0.01, // mm [source] GRBL default $11
  dragFeed: 2000, // mm/min [design] default in src/gcode.js
  settleSeconds: 0.2, // s [design] default in src/gcode.js
};

// The funded build has two different motors. Y moves the whole gantry, the X motor
// included, so it gets the stronger one. A second 17HS15-1504S-X1 for X is an optional
// add-back (docs/BOM.md). The 17HS4401 figures come from one seller's listing.
const MOTORS = {
  X: {
    model: '17HS4401',
    holdingTorque: 40, // N*cm [source] 17HS4401 listing
    phaseResistance: 1.5, // ohm [source] 17HS4401 listing
    phaseInductance: 2.8e-3, // H [source] 17HS4401 listing
    rotorInertia: 54e-7, // kg*m^2 (54 g*cm^2) [source] 17HS4401 listing
    // V [source] the same listing's "rated voltage". At its 1.5 A that means 2.4 ohm, not the
    // 1.5 ohm it also gives, so the listing disagrees with itself (section 11 works both).
    ratedVoltage: 3.6,
  },
  Y: {
    model: '17HS15-1504S-X1',
    holdingTorque: 45, // N*cm [source] StepperOnline product page; Amazon listing B07LF898KN
    phaseResistance: 2.3, // ohm [source] same pages
    phaseInductance: 4.4e-3, // H [source] same pages: 4.4 mH +/-20% (1 kHz)
    inductanceTolerance: 0.2, // [source] same pages
    rotorInertia: 54e-7, // kg*m^2 [assumption] not found for this motor; the 17HS4401's figure
  },
};

const DRIVE = {
  ratedCurrent: 1.5, // A [source] both motor listings
  currentFraction: 0.7, // [design] Vref at about 70% of rating (docs/DESIGN.md)
  torqueDerate: 0.5, // [assumption] usable fraction of the microstepping torque at speed (section 3)
  supplyVolts: 12, // [design]
  supplyRating: 3, // A [design] the funded build's 12 V 3 A adapter (5 A is an optional add-back)
  fuse: 5, // A [design]
  // ohm [source] A4988 datasheet, output on-resistance of each source or sink FET at 1.5 A,
  // TA = 25 C: 0.32 typical, 0.43 maximum. The coil current always flows through two of them.
  rdsOnMax: 0.43,
  rdsOnTypical: 0.32,
  senseResistor: 0.1, // ohm [design] R100 boards; R068 boards (0.068 ohm) lose less
  quiescent: 0.004, // A [source] A4988 datasheet: motor supply current IBB at most 4 mA (fPWM < 50 kHz)
  drivers: 2, // [design] X and Y
};

// Pull-out torque of the 17HS15-1504S-X1 [source]: StepperOnline's published curve at 24 V,
// 1.5 A and 2000 microsteps per turn (the driver is not named). [kpps, N*cm], read from the
// plotted markers; at 2000 microsteps per turn, rpm = kpps x 30.
const Y_CURVE = {
  volts: 24,
  amps: 1.5,
  microstepsPerRev: 2000,
  points: [[1, 42], [3, 43], [7, 43], [10, 40], [13, 35], [17, 30], [20, 25], [23, 22], [27, 18], [33, 14], [40, 10]],
};

const MASS = {
  steelDensity: 7.85, // g/cm^3 [assumption] carbon steel
  plaDensity: 1.24, // g/cm^3 [assumption] typical PLA
  rodDiameter: 8, // mm [design]
  rodLength: 500, // mm [design]
  bearing: 15, // g [assumption] LM8UU listings say 15-16 g; no manufacturer datasheet checked
  carriageBearings: 4, // [assumption] two per X rod
  gantryBearings: 4, // [design] two per Y rod
  carriagePrinted: 40, // g [assumption]
  magnet: 25, // g [assumption] Adafruit's 5 V P20/15 is 22.7 g
  carriageHardware: 15, // g [assumption] spring, screws, belt clamps, belt ends
  xMotor: 350, // g [assumption] 40 mm NEMA 17 bodies are often listed near 280 g; allows a heavier one
  gantryPrinted: 80, // g [assumption] end blocks, X motor and idler mounts
  gantryHardware: 20, // g [assumption] pulley, idler, screws
  resistance: 5, // N per axis [assumption] binding, belt bending, the magnet's PTFE face sliding on the top
};

const PIECE = {
  names: ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'],
  infill: 0.2, // [assumption] cad/pieces.scad suggests 15-20%
  shellThickness: 0.8, // mm [assumption] 2 perimeters of 0.4 mm, 4 layers of 0.2 mm
  washerOuter: 16, // mm [design] M8 flat washer
  washerInner: 8.4, // mm [design]
  washerThickness: 1.6, // mm [design]
  pocketDepth: 1.8, // mm [design] cad/pieces.scad
  pocketDiameter: 16.4, // mm [design] cad/pieces.scad; the pocket is open at the bottom of the base
  // mm [assumption] how far the washer's face sits up inside the pocket: 0.2 if it is
  // glued against the pocket ceiling (1.8 mm pocket, 1.6 mm washer); less if glue sits there
  washerRecess: 0.2,
  baseDiameter: 19, // mm [design] cad/pieces.scad; with no felt the piece stands on this edge
  // The funded build has no felt: the pieces slide on their printed bases. Felt pads are an
  // optional add-back, so sections 4 to 7 work the numbers both ways.
  feltThickness: 1.0, // mm [assumption] self-adhesive felt sheet
  feltDiameter: 18, // mm [assumption] cut a little inside the 19 mm base
  setCount: { pawn: 16, rook: 4, knight: 4, bishop: 4, queen: 4, king: 2 }, // [design] 32 + 2 spare queens
};

// The two cases sections 4 to 7 compare: what stands on the board, and the pivot it tips about.
const CASES = [
  { label: 'funded build, no felt', felt: 0, padRadius: PIECE.baseDiameter / 2 },
  { label: 'with the optional felt', felt: PIECE.feltThickness, padRadius: PIECE.feltDiameter / 2 },
];
const [FUNDED, FELT] = CASES;

// Measured from STL exports of cad/pieces.scad ($fn = 64, OpenSCAD 2021.01).
// Origin at the centre of the base bottom; mm, mm^2, mm^3.
const RECORDED_GEOMETRY = {
  pawn: { volume: 1816.7, area: 1401.1, height: 21.49, volumeCentroid: [0, 0, 7.679], areaCentroid: [0, 0, 6.629] },
  rook: { volume: 2414.4, area: 1635.2, height: 22, volumeCentroid: [0, 0, 9.316], areaCentroid: [0, 0, 8.662] },
  knight: { volume: 2097.4, area: 1523.4, height: 26, volumeCentroid: [0.261, 0, 9.299], areaCentroid: [0.21, 0, 8.196] },
  bishop: { volume: 1875.6, area: 1527.1, height: 27, volumeCentroid: [-0.019, 0, 8.187], areaCentroid: [0.024, 0, 8.101] },
  queen: { volume: 2298.4, area: 1652.4, height: 28, volumeCentroid: [0, 0, 10.214], areaCentroid: [0, 0, 9.659] },
  king: { volume: 2337.7, area: 1659.5, height: 31.5, volumeCentroid: [0, 0, 10.513], areaCentroid: [0, 0, 9.904] },
};

const MAGNET = {
  volts: 12, // [design]
  amps: 0.25, // [design] P20/15 type, about 0.25 A
  ratedHold: 24.5, // N [source] P20/15 listings: 2.5 kg (some say 3 kg)
  ptfeTape: 0.1, // mm [assumption]
  boardTop: 3.0, // mm [design]
  paperSheet: 0.1, // mm [assumption] printed sheet and glue
  // Eclipse Magnetics M52180/12VDC [source]: 20 mm across, 18 mm long, 36 g, 2.5 W
  // (12 V, 210 mA), 100% duty. Pull in whole newtons (+/-10%) against air gap in mm, on
  // its M52171/25ARM armature (25 mm across, 3 mm thick). The last two points give the
  // high estimate; the others show how much that depends on which points are extended.
  reference: { contact: 53, points: [[0.09, 22], [0.18, 9], [0.27, 5], [0.36, 3], [0.59, 2], [1.0, 1]] },
  lowExponent: 3, // [assumption] beyond 1 mm the pull falls with the cube of the gap
  sideRatio: 0.5, // [assumption] peak sideways pull / downward pull at that offset
  pullAtPeakFraction: 0.5, // [assumption] downward pull at that offset / pull when centred
  friction: 0.3, // [assumption] bare PLA (funded) or felt on the paper sheet; 0.2-0.4 tried
  diameter: 20, // mm [design]
  length: 15, // mm [design]
  heatTransfer: 15, // W/(m^2 K) [assumption] still air, convection plus radiation
  heatCapacity: 25 * 0.45, // J/K [assumption] 25 g of steel and copper at about 0.45 J/(g K)
  copperTempco: 0.00393, // per K [source] resistance of copper
  secondsBetweenMoves: 30, // s [assumption] during a game
};

const FRAME = {
  steelModulus: 200000, // N/mm^2 [assumption]
  springPreload: 2, // N [assumption] upper end of a "light" spring
  span: 500, // mm [assumption] whole rod length as the span (conservative)
  beltCentres: 500, // mm [assumption] motor pulley to idler, about one rod length
  beltClampAllowance: 30, // mm per belt end [assumption]
  beltRoll: 5000, // mm [design] the GT2 belt kit in docs/BOM.md
};

const BOARD = { square: 40, storageColumns: 1, pieceDiameter: 0.475 }; // [design]

const HOMING = {
  seekRate: 1500, // mm/min [design] recommended $25 (section 12)
  feedRate: 25, // mm/min [source] GRBL default $24 (defaults.h)
  pulloff: 1, // mm [source] GRBL default $27
  debounce: 0.25, // s [source] GRBL default $26 = 250 ms, a pause after each of the 4 homing phases (limits.c)
  phases: 4, // [source] limits.c: seek, pull off, locate, pull off (N_HOMING_LOCATE_CYCLE = 1)
  travel: 380, // mm [design] X travel, the longer axis; X and Y home together
};

// ---------------------------------------------------------------- helpers

const fix = (value, digits) => value.toFixed(digits);
const lines = [];
const out = (text = '') => lines.push(text);
const heading = (text) => out(`\n${text}\n${'-'.repeat(text.length)}`);
const table = (rows) => {
  const widths = rows[0].map((_, c) => Math.max(...rows.map((row) => String(row[c]).length)));
  for (const row of rows) out(`  ${row.map((cell, c) => (c === 0 ? String(cell).padEnd(widths[c]) : String(cell).padStart(widths[c]))).join('  ')}`);
};
const option = (name) => {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const value = process.argv[i + 1];
  if (value === undefined || value.startsWith('--')) {
    console.error(`${name} needs a directory, for example: node scripts/calculations.js ${name} /tmp/pieces`);
    process.exit(1);
  }
  return value;
};

// GRBL's planner limits a value (speed or acceleration) so no axis exceeds its own limit.
function limitByAxis(maxPerAxis, unit) {
  let limit = Infinity;
  for (const component of unit) if (component !== 0) limit = Math.min(limit, Math.abs(maxPerAxis / component));
  return limit;
}

// ---------------------------------------------------------------- STL geometry

function readStl(file) {
  const data = readFileSync(file);
  const triangles = [];
  const count = data.length >= 84 ? data.readUInt32LE(80) : -1;
  if (count >= 0 && data.length === 84 + count * 50) {
    for (let i = 0; i < count; i++) {
      const at = 84 + i * 50 + 12;
      const v = [];
      for (let k = 0; k < 9; k++) v.push(data.readFloatLE(at + k * 4));
      triangles.push([v.slice(0, 3), v.slice(3, 6), v.slice(6, 9)]);
    }
    return triangles;
  }
  const vertices = [...data.toString('utf8').matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
  for (let i = 0; i + 2 < vertices.length; i += 3) triangles.push([vertices[i], vertices[i + 1], vertices[i + 2]]);
  return triangles;
}

// Volume, surface area and their centroids from a closed triangle mesh
// (signed tetrahedra from the origin, the divergence theorem).
function meshProperties(triangles) {
  let volume = 0;
  let area = 0;
  let height = -Infinity;
  const volumeMoment = [0, 0, 0];
  const areaMoment = [0, 0, 0];
  for (const [a, b, c] of triangles) {
    const cross = [
      b[1] * c[2] - b[2] * c[1],
      b[2] * c[0] - b[0] * c[2],
      b[0] * c[1] - b[1] * c[0],
    ];
    const v = (a[0] * cross[0] + a[1] * cross[1] + a[2] * cross[2]) / 6;
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const s = Math.hypot(...n) / 2;
    volume += v;
    area += s;
    for (let k = 0; k < 3; k++) {
      volumeMoment[k] += (v * (a[k] + b[k] + c[k])) / 4;
      areaMoment[k] += (s * (a[k] + b[k] + c[k])) / 3;
    }
    height = Math.max(height, a[2], b[2], c[2]);
  }
  return {
    volume,
    area,
    height,
    volumeCentroid: volumeMoment.map((m) => m / volume),
    areaCentroid: areaMoment.map((m) => m / area),
  };
}

function pieceGeometry() {
  let dir = option('--stl-dir');
  const exportDir = option('--export-stl');
  if (exportDir) {
    dir = exportDir;
    mkdirSync(dir, { recursive: true });
    const openscad = process.env.OPENSCAD || 'openscad';
    for (const name of PIECE.names) {
      execFileSync(openscad, ['-D', `piece="${name}"`, '-o', path.join(dir, `${name}.stl`), path.join(ROOT, 'cad/pieces.scad')], { stdio: 'ignore' });
    }
  }
  if (!dir) return { source: 'recorded values (run with --stl-dir or --export-stl to re-measure)', geometry: RECORDED_GEOMETRY };
  const geometry = {};
  for (const name of PIECE.names) {
    geometry[name] = meshProperties(readStl(path.join(dir, `${name}.stl`)));
    const recorded = RECORDED_GEOMETRY[name];
    const drift = Math.abs(geometry[name].volume - recorded.volume) / recorded.volume;
    if (!(drift < 0.005)) console.error(`warning: ${name} volume ${fix(geometry[name].volume, 1)} mm^3 differs from the recorded ${fix(recorded.volume, 1)} mm^3`);
  }
  return { source: `measured from the STL files in ${dir}`, geometry };
}

// ---------------------------------------------------------------- GRBL motion model

// Time for one block with a trapezoidal speed profile (mm, mm/s, mm/s^2).
function blockTime(length, entry, exit, nominal, accel) {
  const up = (nominal ** 2 - entry ** 2) / (2 * accel);
  const down = (nominal ** 2 - exit ** 2) / (2 * accel);
  if (up + down <= length) return (nominal - entry) / accel + (nominal - exit) / accel + (length - up - down) / nominal;
  const peak = Math.sqrt((2 * accel * length + entry ** 2 + exit ** 2) / 2);
  return (peak - entry) / accel + (peak - exit) / accel;
}

// Plans a run of blocks that starts and ends at rest, the way GRBL 1.1 does:
// junction-deviation corner speeds, then backward and forward passes.
function runTime(blocks, settings) {
  const n = blocks.length;
  if (!n) return [];
  const speed = new Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    const prev = blocks[i - 1];
    const cur = blocks[i];
    const cosTheta = -(prev.unit[0] * cur.unit[0] + prev.unit[1] * cur.unit[1]);
    let junction;
    if (cosTheta > 0.999999) junction = 0;
    else if (cosTheta < -0.999999) junction = Infinity;
    else {
      const j = [cur.unit[0] - prev.unit[0], cur.unit[1] - prev.unit[1]];
      const jl = Math.hypot(...j);
      const junctionAccel = limitByAxis(settings.accel, [j[0] / jl, j[1] / jl]);
      const sinHalf = Math.sqrt(0.5 * (1 - cosTheta));
      junction = Math.sqrt((junctionAccel * settings.junctionDeviation * sinHalf) / (1 - sinHalf));
    }
    speed[i] = Math.min(junction, prev.nominal, cur.nominal);
  }
  for (let i = n - 1; i >= 0; i--) speed[i] = Math.min(speed[i], Math.sqrt(speed[i + 1] ** 2 + 2 * blocks[i].accel * blocks[i].length));
  for (let i = 0; i < n; i++) speed[i + 1] = Math.min(speed[i + 1], Math.sqrt(speed[i] ** 2 + 2 * blocks[i].accel * blocks[i].length));
  return blocks.map((b, i) => blockTime(b.length, speed[i], speed[i + 1], b.nominal, b.accel));
}

// Estimates how long GRBL takes to run a G-code program from src/gcode.js.
// M8, M9 and G4 wait for motion to stop (GRBL syncs the buffer for them).
function estimateJob(gcode, settings) {
  const result = { total: 0, travel: 0, drag: 0, dwell: 0, magnetOn: 0, travelMm: 0, dragMm: 0 };
  let position = [0, 0];
  let magnet = false;
  let feed = settings.maxRate;
  let pending = [];
  const flush = () => {
    runTime(pending, settings).forEach((t, i) => {
      const kind = pending[i].rapid ? 'travel' : 'drag';
      result[kind] += t;
      result[`${kind}Mm`] += pending[i].length;
      result.total += t;
      if (magnet) result.magnetOn += t;
    });
    pending = [];
  };
  for (const raw of gcode.split('\n')) {
    const line = raw.replace(/;.*/, '').trim();
    if (!line) continue;
    const word = (letter) => {
      const m = line.match(new RegExp(`${letter}(-?[\\d.]+)`));
      return m ? Number(m[1]) : undefined;
    };
    if (/^G[01]\b/.test(line)) {
      const rapid = line.startsWith('G0');
      if (word('F') !== undefined) feed = word('F');
      const target = [word('X') ?? position[0], word('Y') ?? position[1]];
      const delta = [target[0] - position[0], target[1] - position[1]];
      const length = Math.hypot(...delta);
      if (length < 1e-6) continue;
      const unit = [delta[0] / length, delta[1] / length];
      const rapidRate = limitByAxis(settings.maxRate / 60, unit);
      pending.push({
        rapid,
        length,
        unit,
        nominal: rapid ? rapidRate : Math.min(feed / 60, rapidRate),
        accel: limitByAxis(settings.accel, unit),
      });
      position = target;
    } else if (/^G4\b/.test(line)) {
      flush();
      const seconds = word('P');
      result.dwell += seconds;
      result.total += seconds;
      if (magnet) result.magnetOn += seconds;
    } else if (line === 'M8' || line === 'M9') {
      flush();
      magnet = line === 'M8';
    }
  }
  flush();
  return result;
}

// ---------------------------------------------------------------- calculations

const { source: geometrySource, geometry } = pieceGeometry();
const mmPerRev = MOTION.beltPitch * MOTION.pulleyTeeth;

// 1. Steps per mm
heading('1. Steps per mm');
out(`  belt travel per pulley turn: ${MOTION.pulleyTeeth} teeth x ${MOTION.beltPitch} mm = ${mmPerRev} mm`);
out(`  full steps per turn: ${MOTION.fullStepsPerRev}`);
table([
  ['microstepping', 'steps/mm', 'mm per step'],
  ...[16, 8, 1].map((ms) => {
    const spm = (MOTION.fullStepsPerRev * ms) / mmPerRev;
    return [ms === 1 ? 'full step' : `1/${ms}`, fix(spm, 0), fix(1 / spm, 4)];
  }),
]);
const stepsPerMm = (MOTION.fullStepsPerRev * MOTION.microsteps) / mmPerRev;

// 2. Speed limits
heading('2. Speed: step rate and $110/$111');
const feedLimit = (spm) => (MOTION.stepRateLimit / spm) * 60;
out(`  GRBL step-rate ceiling: ${MOTION.stepRateLimit} steps/s per axis`);
out(`  max feed at 1/16: ${fix(feedLimit(stepsPerMm), 0)} mm/min; at 1/8: ${fix(feedLimit(stepsPerMm / 2), 0)} mm/min`);
const maxRateMmS = MOTION.maxRate / 60;
const stepRate = maxRateMmS * stepsPerMm;
const revPerS = maxRateMmS / mmPerRev;
const motorAmps = DRIVE.ratedCurrent * DRIVE.currentFraction;
// Rule of thumb for the speed where the torque falls off: the coil current can still reach
// full value within one full step up to about V / (2 L I) full steps per second.
const cornerFullSteps = (volts, inductance, amps) => volts / (2 * inductance * amps);
const cornerFeed = (fullSteps) => (fullSteps / MOTION.fullStepsPerRev) * mmPerRev * 60;
out(`  chosen $110/$111 = ${MOTION.maxRate} mm/min = ${fix(maxRateMmS, 1)} mm/s`);
out(`    step rate ${fix(stepRate, 0)} steps/s = ${fix((100 * stepRate) / MOTION.stepRateLimit, 0)}% of the ceiling`);
out(`    motor speed ${fix(revPerS, 2)} rev/s = ${fix(revPerS * 60, 0)} rpm = ${fix(revPerS * MOTION.fullStepsPerRev, 0)} full steps/s`);
out(`    diagonal G0 (both axes at their limit): ${fix(MOTION.maxRate * Math.SQRT2, 0)} mm/min`);
out(`  torque roll-off rule of thumb: V / (2 L I), at ${DRIVE.supplyVolts} V and ${fix(motorAmps, 2)} A`);
const rateSetting = { X: '$110', Y: '$111' };
for (const [axis, motor] of Object.entries(MOTORS)) {
  const steps = cornerFullSteps(DRIVE.supplyVolts, motor.phaseInductance, motorAmps);
  out(`    ${axis}, ${motor.model}, ${fix(motor.phaseInductance * 1000, 1)} mH: ${fix(steps, 0)} full steps/s = ${fix(cornerFeed(steps), 0)} mm/min; ${rateSetting[axis]} is ${fix((100 * MOTION.maxRate) / cornerFeed(steps), 1)}% of that`);
  if (motor.inductanceTolerance) {
    const high = cornerFullSteps(DRIVE.supplyVolts, motor.phaseInductance * (1 + motor.inductanceTolerance), motorAmps);
    out(`      at the listing's +${fix(100 * motor.inductanceTolerance, 0)}% inductance (${fix(motor.phaseInductance * (1 + motor.inductanceTolerance) * 1000, 2)} mH): ${fix(high, 0)} full steps/s = ${fix(cornerFeed(high), 0)} mm/min; $111 is ${fix((100 * MOTION.maxRate) / cornerFeed(high), 1)}% of that`);
  }
}
// What the rule of thumb means on the one published curve found, the Y motor's own (taking its
// 1.5 A as the peak current, the same convention as the A4988's limit).
const curveRpm = (kpps) => (kpps * 1000 * 60) / Y_CURVE.microstepsPerRev;
const curvePeak = Math.max(...Y_CURVE.points.map(([, t]) => t));
const flatEnd = Y_CURVE.points.filter(([, t]) => t === curvePeak).at(-1);
const afterFlat = Y_CURVE.points[Y_CURVE.points.indexOf(flatEnd) + 1];
const curveCornerRpm = (cornerFullSteps(Y_CURVE.volts, MOTORS.Y.phaseInductance, Y_CURVE.amps) / MOTION.fullStepsPerRev) * 60;
const curveAt = (rpm) => {
  const pts = Y_CURVE.points.map(([k, t]) => [curveRpm(k), t]);
  for (let i = 1; i < pts.length; i++) {
    const [r0, t0] = pts[i - 1];
    const [r1, t1] = pts[i];
    if (rpm >= r0 && rpm <= r1) return t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
  }
  return NaN;
};
out(`  Y pull-out curve (StepperOnline, ${Y_CURVE.volts} V, ${Y_CURVE.amps} A, ${Y_CURVE.microstepsPerRev} microsteps/turn): ${Y_CURVE.points.map(([k, t]) => `${t} at ${fix(curveRpm(k), 0)}`).join(', ')} (N*cm at rpm)`);
out(`    its own rule-of-thumb speed: ${Y_CURVE.volts} / (2 x ${fix(MOTORS.Y.phaseInductance * 1000, 1)} mH x ${Y_CURVE.amps} A) = ${fix(curveCornerRpm, 0)} rpm, where the curve reads ${fix(curveAt(curveCornerRpm), 0)} N*cm (${fix((100 * curveAt(curveCornerRpm)) / curvePeak, 0)}% of its ${curvePeak} N*cm peak)`);
out(`    the peak holds to ${fix(curveRpm(flatEnd[0]), 0)} rpm = ${fix((100 * curveRpm(flatEnd[0])) / curveCornerRpm, 1)}% of that speed; ${afterFlat[1]} N*cm (${fix((100 * afterFlat[1]) / curvePeak, 0)}%) at ${fix(curveRpm(afterFlat[0]), 0)} rpm = ${fix((100 * curveRpm(afterFlat[0])) / curveCornerRpm, 1)}%`);
// The rule of thumb leaves out back-EMF, which is set by speed, not current, so it takes twice
// the share of 12 V that it takes of 24 V. A rough check [assumption]: treat each phase as a
// sine-driven motor whose torque constant kt is one phase's torque per amp on section 3's
// convention (holding torque / (sqrt 2 x rated current)). At rotor speed w (rad/s) the coil
// then needs sqrt((R I + kt w)^2 + (p w L I)^2) volts, with p = 50 electrical cycles per turn
// (200 full steps / 4): the back-EMF is in phase with the current, the inductive drop 90
// degrees ahead of it. The current stays controllable while that fits under the supply less
// the drop across the driver's two transistors and its sense resistor.
const electricalPerTurn = MOTION.fullStepsPerRev / 4;
const torqueConstant = (motor) => motor.holdingTorque / 100 / (Math.SQRT2 * DRIVE.ratedCurrent); // N*m/A
const coilVolts = (motor, amps, rpm, inductance) => {
  const w = (rpm * 2 * Math.PI) / 60;
  return Math.hypot(motor.phaseResistance * amps + torqueConstant(motor) * w, electricalPerTurn * w * inductance * amps);
};
const voltageLimitRpm = (motor, amps, volts, inductance = motor.phaseInductance) => {
  let low = 0;
  let high = 10000;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (coilVolts(motor, amps, mid, inductance) < volts) low = mid;
    else high = mid;
  }
  return low;
};
const driverDrop = motorAmps * (2 * DRIVE.rdsOnMax + DRIVE.senseResistor);
const voltsLeft = DRIVE.supplyVolts - driverDrop;
const rateRpm = revPerS * 60;
out(`  back-EMF check (rough): kt = holding torque / (sqrt 2 x ${DRIVE.ratedCurrent} A); a coil needs sqrt((R I + kt w)^2 + (${electricalPerTurn} w L I)^2) volts`);
out(`    the A4988 drops ${fix(motorAmps, 2)} A x (2 x ${DRIVE.rdsOnMax} + ${DRIVE.senseResistor} ohm) = ${fix(driverDrop, 2)} V, leaving ${fix(voltsLeft, 1)} V of ${DRIVE.supplyVolts} V`);
const limitRpm = {};
for (const [axis, motor] of Object.entries(MOTORS)) {
  limitRpm[axis] = voltageLimitRpm(motor, motorAmps, voltsLeft);
  out(`    ${axis}, ${motor.model}: kt ${fix(torqueConstant(motor), 2)} N*m/A; needs ${fix(coilVolts(motor, motorAmps, rateRpm, motor.phaseInductance), 1)} V at ${fix(rateRpm, 0)} rpm; current controllable up to about ${fix(limitRpm[axis], 0)} rpm, ${fix(limitRpm[axis] / rateRpm, 1)}x ${rateSetting[axis]}`);
  if (motor.inductanceTolerance) {
    const high = voltageLimitRpm(motor, motorAmps, voltsLeft, motor.phaseInductance * (1 + motor.inductanceTolerance));
    out(`      at the listing's +${fix(100 * motor.inductanceTolerance, 0)}% inductance: needs ${fix(coilVolts(motor, motorAmps, rateRpm, motor.phaseInductance * (1 + motor.inductanceTolerance)), 1)} V at ${fix(rateRpm, 0)} rpm; about ${fix(high, 0)} rpm, ${fix(high / rateRpm, 1)}x`);
  }
}
// The same check at the curve's own settings, with no driver drops (its driver is not named;
// that puts its limit higher and makes the comparison below a little cautious).
const curveLimitRpm = voltageLimitRpm(MOTORS.Y, Y_CURVE.amps, Y_CURVE.volts);
const yFraction = rateRpm / limitRpm.Y;
out(`    the same check at the curve's ${Y_CURVE.volts} V and ${Y_CURVE.amps} A (no driver drops): about ${fix(curveLimitRpm, 0)} rpm; the curve's peak holds to ${fix((100 * curveRpm(flatEnd[0])) / curveLimitRpm, 0)}% of that`);
out(`    $111 is ${fix(100 * yFraction, 0)}% of Y's limit; at ${fix(100 * yFraction, 0)}% of ${fix(curveLimitRpm, 0)} rpm (${fix(yFraction * curveLimitRpm, 0)} rpm) the curve reads ${fix(curveAt(yFraction * curveLimitRpm), 1)} N*cm, ${fix((100 * curveAt(yFraction * curveLimitRpm)) / curvePeak, 0)}% of its peak`);
out(`  drag feed F${MOTION.dragFeed} = ${fix(MOTION.dragFeed / 60, 1)} mm/s = ${fix((MOTION.dragFeed / 60) * stepsPerMm, 0)} steps/s`);

// Pieces: computed here because section 3 needs them, printed in section 4
const washerVolume = (Math.PI / 4) * (PIECE.washerOuter ** 2 - PIECE.washerInner ** 2) * PIECE.washerThickness;
const washerMass = (washerVolume * MASS.steelDensity) / 1000;
if (PIECE.washerRecess > PIECE.pocketDepth - PIECE.washerThickness + 1e-9) throw new Error('washerRecess does not fit the pocket');
const washerZ = PIECE.washerRecess + PIECE.washerThickness / 2; // washer centre above the base bottom
const pieces = PIECE.names.map((name) => {
  const g = geometry[name];
  const shell = Math.min(g.volume, g.area * PIECE.shellThickness);
  const infill = (g.volume - shell) * PIECE.infill;
  const printed = shell + infill;
  const bodyZ = shell >= g.volume ? g.volumeCentroid[2] : (shell * g.areaCentroid[2] + infill * g.volumeCentroid[2]) / printed;
  const bodyMass = (printed * MASS.plaDensity) / 1000;
  const solidMass = (g.volume * MASS.plaDensity) / 1000;
  // cg: height above the bottom of the printed base, so above the board with no felt.
  const combine = (m, z, xy) => {
    const total = m + washerMass;
    return {
      mass: total,
      cg: (m * z + washerMass * washerZ) / total,
      offset: (m * xy) / total,
    };
  };
  const xy = Math.hypot(g.volumeCentroid[0], g.volumeCentroid[1]);
  return {
    name,
    g,
    bodyMass,
    solidMass,
    nominal: combine(bodyMass, bodyZ, xy),
    solid: combine(solidMass, g.volumeCentroid[2], xy),
  };
});

// 3. Moving masses and torque
heading('3. Moving masses and motor torque');
const rodMass = (MASS.steelDensity * (Math.PI / 4) * MASS.rodDiameter ** 2 * MASS.rodLength) / 1000;
const carriage = MASS.carriageBearings * MASS.bearing + MASS.carriagePrinted + MASS.magnet + MASS.carriageHardware;
const gantry = 2 * rodMass + MASS.gantryBearings * MASS.bearing + MASS.xMotor + MASS.gantryPrinted + MASS.gantryHardware + carriage;
out(`  one 8 x ${MASS.rodLength} mm steel rod: ${fix(rodMass, 1)} g`);
out(`  carriage (moves in X): ${MASS.carriageBearings} x ${MASS.bearing} g bearings + ${MASS.carriagePrinted} g printed + ${MASS.magnet} g magnet + ${MASS.carriageHardware} g hardware = ${fix(carriage, 0)} g`);
out(`  gantry (moves in Y): 2 rods ${fix(2 * rodMass, 0)} g + ${MASS.gantryBearings} bearings ${MASS.gantryBearings * MASS.bearing} g + X motor ${MASS.xMotor} g + printed ${MASS.gantryPrinted} g + hardware ${MASS.gantryHardware} g + carriage ${fix(carriage, 0)} g = ${fix(gantry, 0)} g`);
const heaviest = pieces.reduce((a, b) => (b.solid.mass > a.solid.mass ? b : a));
out(`  heaviest piece (${heaviest.name}, solid print): ${fix(heaviest.solid.mass, 2)} g, dragged by the magnet, not the belts`);
const pulleyRadius = (MOTION.pulleyTeeth * MOTION.beltPitch) / (2 * Math.PI); // mm
// [assumption] The holding torque is rated with both phases at the rated current (the
// usual convention; neither listing says). The A4988's current limit sets the peak
// of its microstep sine wave, so at any microstep the torque is that of one phase at
// the limit: holding torque x limit / (sqrt 2 x rated current).
const torqueCurrentFactor = motorAmps / (Math.SQRT2 * DRIVE.ratedCurrent);
const usable = Object.fromEntries(Object.entries(MOTORS).map(([axis, motor]) => [axis, motor.holdingTorque * torqueCurrentFactor * DRIVE.torqueDerate]));
const moving = { X: carriage, Y: gantry }; // g
// Torque the axis motor must give (N*cm): belt force at the pulley plus the rotor's own inertia.
const rotorShare = (axis, accel) => MOTORS[axis].rotorInertia * (accel / 1000 / (pulleyRadius / 1000)) * 100;
const torqueNeeded = (axis, accel) => (((moving[axis] / 1000) * (accel / 1000) + MASS.resistance) * pulleyRadius) / 10 + rotorShare(axis, accel);
out(`  pulley pitch radius ${fix(pulleyRadius, 2)} mm`);
out(`  current factor ${fix(motorAmps, 2)} A / (sqrt 2 x ${DRIVE.ratedCurrent} A) = ${fix(torqueCurrentFactor, 2)}; usable torque = holding torque x ${fix(torqueCurrentFactor, 2)} x ${DRIVE.torqueDerate}`);
for (const [axis, motor] of Object.entries(MOTORS)) {
  out(`    ${axis}, ${motor.model}: ${motor.holdingTorque} x ${fix(torqueCurrentFactor, 2)} x ${DRIVE.torqueDerate} = ${fix(usable[axis], 1)} N*cm`);
}
out(`  check against Y's published curve (section 2): ${curvePeak} N*cm at low speed and ${Y_CURVE.amps} A; this model at ${Y_CURVE.amps} A, before the speed derating: ${MOTORS.Y.holdingTorque} / sqrt 2 = ${fix(MOTORS.Y.holdingTorque / Math.SQRT2, 0)} N*cm`);
out(`    if the curve's ${Y_CURVE.amps} A is rms (${fix(Y_CURVE.amps * Math.SQRT2, 2)} A peak), the model gives ${fix((MOTORS.Y.holdingTorque * Y_CURVE.amps * Math.SQRT2) / (Math.SQRT2 * DRIVE.ratedCurrent), 0)} N*cm there, close to the curve`);
const torqueRows = [['axis', 'accel mm/s^2', 'm*a N', 'resistance N', 'belt N', 'torque N*cm', 'usable N*cm', 'margin']];
for (const accel of [MOTION.accel, 1000]) {
  for (const axis of ['X', 'Y']) {
    const ma = (moving[axis] / 1000) * (accel / 1000);
    const torque = torqueNeeded(axis, accel);
    torqueRows.push([axis, accel, fix(ma, 2), fix(MASS.resistance, 1), fix(ma + MASS.resistance, 2), fix(torque, 2), fix(usable[axis], 1), `${fix(usable[axis] / torque, 1)}x`]);
  }
}
table(torqueRows);
out(`  rotor inertia share at ${MOTION.accel} mm/s^2: ${fix(rotorShare('X', MOTION.accel), 3)} N*cm (Y's rotor inertia was not found; the 17HS4401's is used)`);
out(`    if Y's rotor had twice that inertia, Y would need ${fix(torqueNeeded('Y', MOTION.accel) + rotorShare('Y', MOTION.accel), 2)} N*cm instead of ${fix(torqueNeeded('Y', MOTION.accel), 2)}`);

// 4. Pieces
heading('4. Piece mass and centre of gravity');
out(`  geometry: ${geometrySource}`);
out(`  M8 washer: pi/4 x (${PIECE.washerOuter}^2 - ${PIECE.washerInner}^2) x ${PIECE.washerThickness} = ${fix(washerVolume, 1)} mm^3 of steel = ${fix(washerMass, 2)} g`);
out(`    face ${fix(PIECE.washerRecess, 1)} mm up inside the ${PIECE.pocketDepth} mm pocket, centre ${fix(washerZ, 1)} mm above the base bottom`);
out(`  printed mass = PLA ${MASS.plaDensity} g/cm^3 x (shell + ${PIECE.infill * 100}% of the inside); shell = min(volume, area x ${PIECE.shellThickness} mm)`);
out(`  CG heights are above the board for the ${FUNDED.label}; add ${fix(FELT.felt, 1)} mm ${FELT.label} pad`);
table([
  ['piece', 'tall mm', 'volume cm^3', 'area cm^2', 'printed g', 'solid g', 'total g', 'CG mm', 'CG solid mm', 'CG off-axis mm'],
  ...pieces.map((p) => [
    p.name,
    fix(p.g.height, 1),
    fix(p.g.volume / 1000, 2),
    fix(p.g.area / 100, 1),
    fix(p.bodyMass, 2),
    fix(p.solidMass, 2),
    fix(p.nominal.mass, 2),
    fix(p.nominal.cg, 1),
    fix(p.solid.cg, 1),
    fix(p.solid.offset, 2),
  ]),
]);
const setPla = pieces.reduce((sum, p) => sum + p.bodyMass * PIECE.setCount[p.name], 0);
const setCount = Object.values(PIECE.setCount).reduce((a, b) => a + b, 0);
out(`  PLA for the ${setCount}-piece set at ${PIECE.infill * 100}% infill: ${fix(setPla, 0)} g (slicer extras such as skirts not included)`);
const cgRange = (key, felt) => `${fix(Math.min(...pieces.map((p) => p[key].cg)) + felt, 1)}-${fix(Math.max(...pieces.map((p) => p[key].cg)) + felt, 1)}`;
for (const c of CASES) out(`  CG above the board, ${c.label}: ${cgRange('nominal', c.felt)} mm (${cgRange('solid', c.felt)} mm if printed solid)`);

// 5. Magnet pull through the gap
heading('5. Magnet pull through the board (estimate)');
const gapFor = (c) => MAGNET.ptfeTape + MAGNET.boardTop + MAGNET.paperSheet + c.felt + PIECE.washerRecess;
for (const c of CASES) c.gap = gapFor(c);
out(`  gap = PTFE ${MAGNET.ptfeTape} + top ${MAGNET.boardTop} + paper ${MAGNET.paperSheet} + felt + washer recess ${fix(PIECE.washerRecess, 1)}`);
for (const c of CASES) out(`    ${c.label}: felt ${fix(c.felt, 1)} mm, gap ${fix(c.gap, 1)} mm`);
const refPoints = MAGNET.reference.points;
const [g1, f1] = refPoints.at(-2);
const [g2, f2] = refPoints.at(-1);
// Exponent of the power law through a table point and the last (1.00 mm) point.
const slopeTo = ([g, f]) => Math.log(f / f2) / Math.log(g2 / g);
const highExponent = slopeTo([g1, f1]);
const lowScale = MAGNET.ratedHold / MAGNET.reference.contact;
const pullHighAt = (g) => f2 * (g2 / g) ** highExponent;
const pullLowAt = (g) => f2 * lowScale * (g2 / g) ** MAGNET.lowExponent;
out(`  reference (whole newtons): ${MAGNET.reference.contact} N in contact, ${refPoints.map(([g, f]) => `${f} N at ${fix(g, 2)} mm`).join(', ')}`);
out(`  high estimate: F = ${f2} N x (1 mm / gap)^${fix(highExponent, 2)} (the slope between ${g1} and ${g2} mm, continued)`);
out(`  low estimate: F = ${f2} N x ${MAGNET.ratedHold}/${MAGNET.reference.contact} x (1 mm / gap)^${MAGNET.lowExponent}`);
const heaviestWeight = (heaviest.solid.mass / 1000) * G;
const thinTopGap = FUNDED.gap - 1;
table([
  ['gap', 'high N', 'low N', `${heaviest.name} weight N`],
  ...[
    [FUNDED.gap, FUNDED.label],
    [FELT.gap, FELT.label],
    [thinTopGap, 'no felt, 2 mm top'],
  ].map(([g, label]) => [`${fix(g, 1)} mm (${label})`, fix(pullHighAt(g), 3), fix(pullLowAt(g), 4), fix(heaviestWeight, 3)]),
]);
out(`  the same power law through ${g2} mm, from each earlier table point:`);
const spreadAt = (gap) => refPoints.slice(0, -1).map((point) => ({ point, exponent: slopeTo(point), pull: f2 * (g2 / gap) ** slopeTo(point) }));
table([
  ['from', 'exponent', ...CASES.map((c) => `pull at ${fix(c.gap, 1)} mm N`)],
  ...refPoints.slice(0, -1).map((point, i) => [`${fix(point[0], 2)} mm (${point[1]} N)`, fix(slopeTo(point), 2), ...CASES.map((c) => fix(spreadAt(c.gap)[i].pull, 3))]),
]);
for (const c of CASES) {
  c.pullHigh = pullHighAt(c.gap);
  c.pullLow = pullLowAt(c.gap);
  c.spreadLow = Math.min(...spreadAt(c.gap).map((s) => s.pull));
  c.spreadHigh = Math.max(...spreadAt(c.gap).map((s) => s.pull));
  out(`  ${c.label}, ${fix(c.gap, 1)} mm: estimates ${fix(c.pullLow, 4)} N (low) and ${fix(c.pullHigh, 3)} N (high), ${fix(c.pullLow / heaviestWeight, 2)} and ${fix(c.pullHigh / heaviestWeight, 2)} times the ${heaviest.name}'s weight; other table points give ${fix(c.spreadLow, 3)} to ${fix(c.spreadHigh, 3)} N`);
}
out(`  removing the felt multiplies the pull by ${fix(FUNDED.pullHigh / FELT.pullHigh, 2)} (high) or ${fix(FUNDED.pullLow / FELT.pullLow, 2)} (low)`);
out(`  a 2 mm top on top of that (gap ${fix(thinTopGap, 1)} mm) multiplies the funded build's pull by ${fix(pullHighAt(thinTopGap) / FUNDED.pullHigh, 2)} (high) or ${fix(pullLowAt(thinTopGap) / FUNDED.pullLow, 2)} (low)`);

// 6. Tipping
heading('6. Tipping');
const mu = MAGNET.friction;
out(`  pivot: the edge the piece stands on (radius r, less the CG's off-axis offset); the magnet acts at the washer, zw above the board`);
out(`  A: g x r / h                         (drive at the board surface, no friction, no magnet pull)`);
out(`  B: g x (r - mu zw) / (h - zw)        (drive at the washer while braking, mu = ${mu})`);
out(`  C: (g + Fv/m) x (r - mu zw) / (h - zw), Fv = ${MAGNET.pullAtPeakFraction} x the centred pull (low and high estimates at that case's gap)`);
out(`  solid prints (heavier, higher CG: the worse case); tipping accelerations in mm/s^2, to the nearest 100`);
const mmS2 = (value) => String(Math.round(value * 10) * 100); // m/s^2 to mm/s^2, nearest 100
for (const c of CASES) {
  const zw = washerZ + c.felt;
  out(`  ${c.label}: r = ${fix(c.padRadius, 1)} mm (${c.felt ? 'the felt pad' : 'the printed base'}), zw = ${fix(zw, 1)} mm, Fv = ${fix(MAGNET.pullAtPeakFraction * c.pullLow, 4)} N (low) or ${fix(MAGNET.pullAtPeakFraction * c.pullHigh, 3)} N (high)`);
  const tipRows = [['piece', 'CG mm', 'mass g', 'A', 'B', 'C low', 'C high', 'A / $120']];
  for (const p of pieces) {
    const h = p.solid.cg + c.felt;
    const reff = c.padRadius - p.solid.offset;
    const m = p.solid.mass / 1000;
    const a = (G * reff) / h;
    const b = (G * (reff - mu * zw)) / (h - zw);
    const full = (pull) => (G + (MAGNET.pullAtPeakFraction * pull) / m) * ((reff - mu * zw) / (h - zw));
    tipRows.push([p.name, fix(h, 1), fix(p.solid.mass, 2), mmS2(a), mmS2(b), mmS2(full(c.pullLow)), mmS2(full(c.pullHigh)), `${fix((a * 1000) / MOTION.accel, 0)}x`]);
  }
  table(tipRows);
}
// With no felt the washer is exposed: the pocket is open at the bottom of the base, so the
// piece stands on the ring of PLA around it. If the washer sits flush with that ring or proud
// of it (glue between it and the top of its pocket, a washer as thick as the pocket), the
// piece stands on the steel and tips about the washer's edge instead. h is kept at the
// funded build's (a flush washer lowers the CG slightly, which only helps).
const ringWidth = (PIECE.baseDiameter - PIECE.pocketDiameter) / 2;
const onSteel = pieces
  .map((p) => ({ p, a: (G * (PIECE.washerOuter / 2 - p.solid.offset)) / p.solid.cg }))
  .reduce((x, y) => (y.a < x.a ? y : x));
out(`  ${FUNDED.label}: the base stands on a ${fix(ringWidth, 1)} mm ring of PLA round the open washer pocket, the washer's face ${fix(PIECE.washerRecess, 1)} mm above the board`);
out(`    if the washer sits flush or proud, the piece stands on the steel: r = ${fix(PIECE.washerOuter / 2, 1)} mm, A for the ${onSteel.p.name} = ${mmS2(onSteel.a)} mm/s^2 (${fix((onSteel.a * 1000) / MOTION.accel, 0)}x $120)`);

// 7. Grip
heading('7. Grip: does the piece follow the magnet?');
const m = heaviest.solid.mass / 1000;
const weight = m * G;
const inertia = m * (MOTION.accel / 1000);
out(`  heaviest piece ${heaviest.name}: m = ${fix(heaviest.solid.mass, 2)} g, weight ${fix(weight, 4)} N, m x a at ${MOTION.accel} mm/s^2 = ${fix(inertia, 4)} N`);
out(`  friction from the weight alone: mu x weight = ${fix(mu * weight, 4)} N (mu = ${mu} assumed for bare PLA, the funded build, and for felt alike; no figure was found for either)`);
out(`  needed sideways force = mu x (weight + Fv) + m a; available = s x Fv, s = ${MAGNET.sideRatio}`);
out(`  so Fv x (s - mu) >= mu x weight + m a, and the centred pull F >= Fv / ${MAGNET.pullAtPeakFraction}`);
const required = (friction, side) => (side > friction ? (friction * weight + inertia) / (side - friction) / MAGNET.pullAtPeakFraction : Infinity);
const sides = [0.4, MAGNET.sideRatio, 0.7];
out('  centred pull needed, N (rows: mu; columns: s):');
table([
  ['mu', ...sides.map((s) => `s = ${s}`)],
  ...[0.2, 0.3, 0.4].map((friction) => [fix(friction, 1), ...sides.map((s) => (Number.isFinite(required(friction, s)) ? fix(required(friction, s), 3) : 'never'))]),
]);
out(`  largest gap that gives that pull, s = ${MAGNET.sideRatio}:`);
table([
  ['mu', 'pull needed N', 'high-estimate gap mm', 'low-estimate gap mm'],
  ...[0.2, 0.3, 0.4].map((friction) => {
    const need = required(friction, MAGNET.sideRatio);
    const gapHigh = g2 * (f2 / need) ** (1 / highExponent);
    const gapLow = g2 * ((f2 * lowScale) / need) ** (1 / MAGNET.lowExponent);
    return [fix(friction, 1), fix(need, 3), fix(gapHigh, 1), fix(gapLow, 1)];
  }),
]);
const pullNeeded = required(mu, MAGNET.sideRatio);
const sidewaysRatio = (pull) => {
  const fv = MAGNET.pullAtPeakFraction * pull;
  return { need: mu * (weight + fv) + inertia, have: MAGNET.sideRatio * fv };
};
for (const c of CASES) {
  out(`  ${c.label}, ${fix(c.gap, 1)} mm gap:`);
  for (const [label, pull] of [['high estimate', c.pullHigh], ['top of the table-slope range', c.spreadHigh], ['low estimate', c.pullLow]]) {
    const { need, have } = sidewaysRatio(pull);
    out(`    ${label} ${fix(pull, 4)} N = ${fix(pull / pullNeeded, 2)} x the ${fix(pullNeeded, 3)} N needed: sideways needed ${fix(need, 4)} N, available ${fix(have, 4)} N, ratio ${fix(have / need, 2)}`);
  }
}

// Standing pieces the switched-on magnet passes. Replay the reset job (section 10)
// to find how close its drags come to pieces that are not moving.
const board = createBoard({ storageColumns: BOARD.storageColumns });
const { from, to } = scenario(board, 'reset');
const plan = planArrangement(board, from, to, { pieceDiameter: BOARD.pieceDiameter });
const standing = toArrangement(board, from);
let closest = Infinity;
let closePasses = 0;
for (const move of plan.moves) {
  const source = parseCell(board, move.from);
  for (const cell of standing.keys()) {
    if (cell === source) continue;
    let distance = Infinity;
    for (let k = 1; k < move.path.length; k++) {
      const a = move.path[k - 1];
      const b = move.path[k];
      distance = Math.min(distance, pointSegmentDistance(cellX(board, cell), cellY(board, cell), a.x, a.y, b.x, b.y));
    }
    closest = Math.min(closest, distance);
    if (distance <= 0.5 + 1e-9) closePasses++; // within half a square
  }
  const piece = standing.get(source);
  standing.delete(source);
  standing.set(parseCell(board, move.to), piece);
}
const closestMm = closest * BOARD.square;
const lightest = pieces.reduce((a, b) => (b.nominal.mass < a.nominal.mass ? b : a));
const lightWeight = (lightest.nominal.mass / 1000) * G;
out(`  standing pieces: src/motion.js keeps at least ${fix(BOARD.pieceDiameter * BOARD.square, 0)} mm (${BOARD.pieceDiameter} x ${BOARD.square} mm) between a dragged piece's centre and every other piece's centre`);
out(`    in the ${plan.stats.moves}-move reset job, with the magnet on, drags pass a standing piece within ${BOARD.square / 2} mm ${closePasses} times; the closest is ${fix(closestMm, 1)} mm`);
out(`    a washer ${BOARD.square / 2} mm off the magnet's axis has its near edge ${fix(BOARD.square / 2 - PIECE.washerOuter / 2, 0)} mm from it; the magnet's radius is ${MAGNET.diameter / 2} mm`);
out(`    lightest piece: ${lightest.name} at ${PIECE.infill * 100}% infill, ${fix(lightest.nominal.mass, 2)} g, weight ${fix(lightWeight, 4)} N`);
out(`    it stays put while the sideways pull on it is below mu x weight (the magnet's downward pull on it, ignored here, only helps)`);
table([
  ['mu', 'centred pull needed N', 'peak sideways pull needed N', 'lightest piece holds N', 'contrast needed'],
  ...[0.2, 0.3, 0.4].map((friction) => {
    const sideways = MAGNET.sideRatio * MAGNET.pullAtPeakFraction * required(friction, MAGNET.sideRatio);
    const hold = friction * lightWeight;
    return [fix(friction, 1), fix(required(friction, MAGNET.sideRatio), 3), fix(sideways, 4), fix(hold, 4), `${fix(sideways / hold, 1)}x`];
  }),
]);
// The felt add-back adds 1 mm of gap, so it only helps grip if it slides enough more easily
// than bare PLA. Friction coefficient at which the felt needs a pull smaller by the gap's ratio:
// mu = (target k s - m a) / (weight + target k), with target = pull needed / ratio, k = fraction.
const breakEven = (ratio) => {
  const target = pullNeeded / ratio;
  const k = MAGNET.pullAtPeakFraction;
  return (target * k * MAGNET.sideRatio - inertia) / (weight + target * k);
};
out(`  felt breaks even with bare PLA at mu = ${mu} if the felt's mu is below ${fix(breakEven(FUNDED.pullHigh / FELT.pullHigh), 2)} (high-estimate slope) or ${fix(breakEven(FUNDED.pullLow / FELT.pullLow), 2)} (low)`);
// A magnet stronger than just enough pulls harder 20 mm out too, so the contrast it needs
// grows with its strength (mu = 0.3).
const holdPawn = mu * lightWeight;
out(`    if the magnet is stronger than just enough, the peak sideways pull is s x ${MAGNET.pullAtPeakFraction} x the centred pull, so (mu = ${mu}):`);
for (const c of CASES) {
  const contrast = (pull) => (MAGNET.sideRatio * MAGNET.pullAtPeakFraction * pull) / holdPawn;
  out(`      ${c.label}, ${fix(c.gap, 1)} mm: ${fix(contrast(c.pullHigh), 1)}x at the high estimate (${fix(c.pullHigh, 3)} N), ${fix(contrast(c.spreadHigh), 1)}x at the top of the range (${fix(c.spreadHigh, 3)} N)`);
}

// 8. Rod deflection
heading('8. Rod deflection');
const inertiaRod = (Math.PI * MASS.rodDiameter ** 4) / 64;
const ei = FRAME.steelModulus * inertiaRod;
const L = FRAME.span;
const selfLoad = ((rodMass / 1000) * G) / L; // N/mm
const selfSag = (5 * selfLoad * L ** 4) / (384 * ei);
out(`  I = pi d^4 / 64 = ${fix(inertiaRod, 1)} mm^4; E = ${FRAME.steelModulus} N/mm^2; span ${L} mm, simply supported`);
out(`  own weight: 5 w L^4 / (384 E I) = ${fix(selfSag, 3)} mm`);
const sag = (load) => (load * L ** 3) / (48 * ei);
const xLoad = ((carriage / 1000) * G + FRAME.springPreload) / 2;
const yLoad = ((gantry / 1000) * G + FRAME.springPreload) / 2;
out(`  X rod: P = (carriage ${fix((carriage / 1000) * G, 2)} N + spring ${FRAME.springPreload} N) / 2 = ${fix(xLoad, 2)} N; P L^3 / (48 E I) = ${fix(sag(xLoad), 3)} mm; with own weight ${fix(sag(xLoad) + selfSag, 2)} mm`);
out(`  Y rod: P = (gantry ${fix((gantry / 1000) * G, 2)} N + spring ${FRAME.springPreload} N) / 2 = ${fix(yLoad, 2)} N; P L^3 / (48 E I) = ${fix(sag(yLoad), 3)} mm; with own weight ${fix(sag(yLoad) + selfSag, 2)} mm`);
out(`  worst case at the middle of the board: ${fix(sag(xLoad) + sag(yLoad) + 2 * selfSag, 2)} mm`);
out(`  if the holders clamp the rod ends rigidly, the load sag is P L^3 / (192 E I): ${fix(sag(xLoad) / 4, 3)} mm (X), ${fix(sag(yLoad) / 4, 3)} mm (Y)`);

// 9. Belts
heading('9. Belt lengths');
const loop = 2 * FRAME.beltCentres + MOTION.pulleyTeeth * MOTION.beltPitch + 2 * FRAME.beltClampAllowance;
out(`  one loop = 2 x ${FRAME.beltCentres} + ${MOTION.pulleyTeeth * MOTION.beltPitch} (half of each pulley) + 2 x ${FRAME.beltClampAllowance} (clamps) = ${loop} mm`);
out(`  X + Y loops: ${2 * loop} mm of ${FRAME.beltRoll} mm; spare ${FRAME.beltRoll - 2 * loop} mm (a third loop would leave ${FRAME.beltRoll - 3 * loop} mm)`);
out(`  the idlers are ${MOTION.pulleyTeeth}-tooth either way (the belt kit's 5 mm-bore ones or the optional 3 mm-bore ones), so the loop is the same`);

// 10. Reset job
heading('10. Reset job: time and magnet duty');
out(`  plan: ${plan.stats.moves} moves, ${fix(plan.stats.drag * BOARD.square, 0)} mm dragged, ${fix(plan.stats.travel * BOARD.square, 0)} mm of empty travel between moves (planner figures)`);
const runJob = (settings, dragFeed) => estimateJob(toGcode(plan.moves, { squareMm: BOARD.square, dragFeed, settleSeconds: MOTION.settleSeconds }), settings);
const baseSettings = { maxRate: MOTION.maxRate, accel: MOTION.accel, junctionDeviation: MOTION.junctionDeviation };
const job = runJob(baseSettings, MOTION.dragFeed);
out(`  G-code, starting and ending at X0 Y0: ${fix(job.travelMm, 0)} mm of G0 travel, ${fix(job.dragMm, 0)} mm of G1 drags`);
out(`  at $110 ${MOTION.maxRate}, $120 ${MOTION.accel}, F${MOTION.dragFeed}:`);
out(`    travel ${fix(job.travel, 1)} s + drags ${fix(job.drag, 1)} s + pauses ${fix(job.dwell, 1)} s = ${fix(job.total, 1)} s (${fix(job.total / 60, 1)} min)`);
out(`    magnet on ${fix(job.magnetOn, 1)} s = ${fix((100 * job.magnetOn) / job.total, 0)}% of the job; ${fix(job.magnetOn / plan.stats.moves, 2)} s per move`);
out(`    drags at an average ${fix(job.dragMm / job.drag, 1)} mm/s against F${MOTION.dragFeed} = ${fix(MOTION.dragFeed / 60, 1)} mm/s (corners slow them down)`);
const variants = [
  ['recommended', baseSettings, MOTION.dragFeed],
  ['drag F1000', baseSettings, 1000],
  ['drag F3000', baseSettings, 3000],
  ['$120 = 800', { ...baseSettings, accel: 800 }, MOTION.dragFeed],
  ['$110 = 10000', { ...baseSettings, maxRate: 10000 }, MOTION.dragFeed],
];
table([
  ['settings', 'travel s', 'drags s', 'pauses s', 'total s', 'magnet on'],
  ...variants.map(([label, settings, feed]) => {
    const j = runJob(settings, feed);
    return [label, fix(j.travel, 1), fix(j.drag, 1), fix(j.dwell, 1), fix(j.total, 1), `${fix((100 * j.magnetOn) / j.total, 0)}%`];
  }),
]);

// 11. Power and heat
heading('11. Power budget and magnet heat');
const volts = DRIVE.supplyVolts;
// While a coil is driven, its bridge draws exactly the coil current from the supply; in slow
// decay it draws nothing, and in fast decay it returns current, so a coil never draws more
// than its own current. The two coils' currents add up to at most sqrt 2 x the limit (both at
// 71% of it, as at each full-step position). This takes the limit as exactly 1.05 A: one set
// higher (Vref set high, the A4988's own trip-level error) raises the motors' share with it.
const motorSupplyBound = Math.SQRT2 * motorAmps;
const supplyPeak = 2 * motorSupplyBound + MAGNET.amps;
const magnetWatts = MAGNET.volts * MAGNET.amps;
out(`  motor current limit ${DRIVE.currentFraction} x ${DRIVE.ratedCurrent} A = ${fix(motorAmps, 2)} A (the peak of the microstep sine)`);
out(`  A4988: Vref = I x 8 x Rs; Rs = 0.100 ohm (R100) gives ${fix(motorAmps * 8 * 0.1, 2)} V, Rs = 0.068 ohm (R068) gives ${fix(motorAmps * 8 * 0.068, 2)} V`);
out(`  supply current, upper bound: each motor at most both coils' currents, sqrt 2 x ${fix(motorAmps, 2)} = ${fix(motorSupplyBound, 2)} A`);
out(`    2 x ${fix(motorSupplyBound, 2)} A + magnet ${MAGNET.amps} A = ${fix(supplyPeak, 2)} A (${fix(supplyPeak * volts, 0)} W) for the coils and the magnet, with the limit at exactly ${fix(motorAmps, 2)} A`);
out(`    ${fix(supplyPeak - DRIVE.supplyRating, 2)} A over the funded build's ${DRIVE.supplyRating} A adapter; under the optional 5 A adapter and the ${DRIVE.fuse} A fuse`);
out(`    far from it in use: at standstill a coil needs only ${fix(motorAmps, 2)} A x R of the ${volts} V: ${Object.entries(MOTORS).map(([axis, motor]) => `${fix(motorAmps * motor.phaseResistance, 1)} V on ${axis}`).join(', ')}`);
// Estimate from an energy balance. Averaged over many steps (whole electrical cycles, over
// which the energy stored in the coils comes back to where it started), the supply provides
// the power the motors and drivers use: the coils' copper loss, the drivers' conduction loss,
// the sense resistors, the drivers' own supply current and the mechanical output. The decay
// mode does not change this: slow decay recirculates the current inside the bridge, and fast
// decay returns the coils' stored energy to the 12 V rail, so the balance already nets them
// out; their cost is the conduction loss counted here. At every microstep the two coil
// currents are I cos and I sin of the step angle, so each loss is I^2 x the resistance the
// current flows through, at any position.
// Pulley speed (rad/s) at a feed in mm/s.
const pulleySpeed = (mmPerS) => mmPerS / pulleyRadius;
const omega = pulleySpeed(maxRateMmS); // at $110
const motorWatts = (axis, rdsOn, outputTorque, speed = omega, resistance = MOTORS[axis].phaseResistance) => {
  const copper = motorAmps ** 2 * resistance;
  const driver = motorAmps ** 2 * 2 * rdsOn; // two FETs carry each coil's current
  const sense = motorAmps ** 2 * DRIVE.senseResistor; // at most: the sense resistor never carries more
  const output = (outputTorque / 100) * speed; // N*cm to N*m, times rad/s
  return { copper, driver, sense, output, total: copper + driver + sense + output };
};
const quiescentAmps = DRIVE.drivers * DRIVE.quiescent;
const loadTorque = (axis) => torqueNeeded(axis, MOTION.accel);
const listedResistance = (axis) => MOTORS[axis].phaseResistance;
// Supply current: both motors energized (GRBL enables both drivers together), both axes
// giving torqueFor(axis) at the given feed, plus the drivers' own current and the magnet.
const estimate = ({ rdsOn = DRIVE.rdsOnMax, torqueFor = loadTorque, mmPerS = maxRateMmS, magnet = true, motorScale = 1, resistanceFor = listedResistance } = {}) => {
  const watts = Object.keys(MOTORS).map((axis) => motorWatts(axis, rdsOn, torqueFor(axis), pulleySpeed(mmPerS), resistanceFor(axis)).total);
  return (motorScale * watts.reduce((a, b) => a + b, 0)) / volts + quiescentAmps + (magnet ? MAGNET.amps : 0);
};
out(`  supply current, estimate: energy balance, both motors at $110 = ${MOTION.maxRate} mm/min (${fix(omega, 1)} rad/s at the pulley) with section 3's torque at ${MOTION.accel} mm/s^2, magnet on`);
out(`    copper = ${fix(motorAmps, 2)}^2 x R; driver = ${fix(motorAmps, 2)}^2 x 2 x Rds(on) ${DRIVE.rdsOnMax} ohm (A4988 maximum at 25 C); sense resistors at most ${fix(motorAmps, 2)}^2 x ${DRIVE.senseResistor} ohm`);
const powerRows = [['motor', 'R ohm', 'copper W', 'driver W', 'sense W', 'output W', 'total W', 'from 12 V A']];
let motorsWatts = 0;
for (const axis of Object.keys(MOTORS)) {
  const w = motorWatts(axis, DRIVE.rdsOnMax, loadTorque(axis));
  motorsWatts += w.total;
  powerRows.push([`${axis} ${MOTORS[axis].model}`, fix(MOTORS[axis].phaseResistance, 1), fix(w.copper, 2), fix(w.driver, 2), fix(w.sense, 2), fix(w.output, 2), fix(w.total, 2), fix(w.total / volts, 2)]);
}
table(powerRows);
const supplyEstimate = estimate();
out(`    motors ${fix(motorsWatts / volts, 2)} A + drivers' own supply current ${DRIVE.drivers} x ${DRIVE.quiescent * 1000} mA = ${fix(quiescentAmps, 3)} A + magnet ${MAGNET.amps} A`);
out(`    = ${fix(supplyEstimate, 2)} A (${fix(supplyEstimate * volts, 1)} W) = ${fix((100 * supplyEstimate) / DRIVE.supplyRating, 0)}% of the ${DRIVE.supplyRating} A adapter: ${fix(DRIVE.supplyRating / supplyEstimate, 1)}x margin`);
const hot = 50; // K [assumption] a warm winding; used for the motors here and the magnet below
const hotResistance = 1 + MAGNET.copperTempco * hot;
const xListingResistance = MOTORS.X.ratedVoltage / DRIVE.ratedCurrent;
out('    what-ifs, each changing one input of that case (the figure is the total supply current):');
out(`      typical Rds(on) ${DRIVE.rdsOnTypical} ohm: ${fix(estimate({ rdsOn: DRIVE.rdsOnTypical }), 2)} A`);
out(`      windings ${hot} K above room temperature (copper resistance x ${fix(hotResistance, 2)}): ${fix(estimate({ resistanceFor: (axis) => MOTORS[axis].phaseResistance * hotResistance }), 2)} A`);
out(`      X coil at ${fix(xListingResistance, 1)} ohm (its listing's ${MOTORS.X.ratedVoltage} V rated voltage / ${DRIVE.ratedCurrent} A): ${fix(estimate({ resistanceFor: (axis) => (axis === 'X' ? xListingResistance : MOTORS[axis].phaseResistance) }), 2)} A`);
out(`      each axis needs all its usable torque at that speed: ${fix(estimate({ torqueFor: (axis) => usable[axis] }), 2)} A`);
out(`      each motor gives its full torque at ${fix(motorAmps, 2)} A (${Object.entries(MOTORS).map(([axis, motor]) => `${fix(motor.holdingTorque * torqueCurrentFactor, 1)} N*cm on ${axis}`).join(', ')}; no ${DRIVE.torqueDerate} derating), the most it can give before it stalls on section 3's model: ${fix(estimate({ torqueFor: (axis) => MOTORS[axis].holdingTorque * torqueCurrentFactor }), 2)} A`);
out(`      the motors' share twice the estimate (switching and iron losses, a hot driver): ${fix(estimate({ motorScale: 2 }), 2)} A`);
out(`    reaching the bound would take ${fix(2 * motorSupplyBound * volts, 1)} W into the motors and drivers; the estimate is ${fix(motorsWatts, 1)} W (${fix((2 * motorSupplyBound * volts) / motorsWatts, 1)}x)`);
out('  what a meter in series with the 12 V lead should show (same estimate):');
out('    Milestone 2, motors only:');
out(`      homing at $25 = ${HOMING.seekRate} mm/min: ${fix(estimate({ mmPerS: HOMING.seekRate / 60, magnet: false }), 2)} A`);
out(`      motors enabled and still ($1 = 255): ${fix(estimate({ mmPerS: 0, magnet: false }), 2)} A (the losses alone, no output)`);
out(`      G0 travel at $110: ${fix(estimate({ magnet: false }), 2)} A`);
out('    Milestone 3, with the magnet wired:');
out(`      a drag at F${MOTION.dragFeed}, magnet on: ${fix(estimate({ mmPerS: MOTION.dragFeed / 60 }), 2)} A`);
out(`  magnet: ${MAGNET.volts} V x ${MAGNET.amps} A = ${fix(magnetWatts, 1)} W; coil ${fix(MAGNET.volts / MAGNET.amps, 0)} ohm`);
// Exposed surface: the side and the back; the face presses on the board top.
const exposed = Math.PI * MAGNET.diameter * MAGNET.length + (Math.PI / 4) * MAGNET.diameter ** 2; // mm^2
const thermalResistance = 1 / (MAGNET.heatTransfer * exposed * 1e-6);
const tau = thermalResistance * MAGNET.heatCapacity;
out(`  thermal model: R = 1 / (h A) = 1 / (${MAGNET.heatTransfer} W/(m^2 K) x ${fix(exposed, 0)} mm^2) = ${fix(thermalResistance, 0)} K/W`);
out(`    C = ${fix(MAGNET.heatCapacity, 2)} J/K, time constant R C = ${fix(tau, 0)} s (${fix(tau / 60, 0)} min)`);
const duty = job.magnetOn / job.total;
const gameDuty = job.magnetOn / plan.stats.moves / MAGNET.secondsBetweenMoves;
const oneJobRise = magnetWatts * duty * thermalResistance * (1 - Math.exp(-job.total / tau));
table([
  ['case', 'duty', 'average W', 'temperature rise K'],
  ['left on continuously (steady)', '100%', fix(magnetWatts, 2), fix(magnetWatts * thermalResistance, 0)],
  ['one reset job from cold', `${fix(100 * duty, 0)}%`, fix(magnetWatts * duty, 2), fix(oneJobRise, 0)],
  ['reset jobs back to back (steady)', `${fix(100 * duty, 0)}%`, fix(magnetWatts * duty, 2), fix(magnetWatts * duty * thermalResistance, 0)],
  [`a game, one move every ${MAGNET.secondsBetweenMoves} s (steady)`, `${fix(100 * gameDuty, 0)}%`, fix(magnetWatts * gameDuty, 2), fix(magnetWatts * gameDuty * thermalResistance, 0)],
]);
const currentWhenHot = 1 / (1 + MAGNET.copperTempco * hot);
out(`  a coil ${hot} K above room temperature: resistance x ${fix(1 + MAGNET.copperTempco * hot, 2)}, current ${fix(100 * currentWhenHot, 0)}%, pull about ${fix(100 * currentWhenHot ** 2, 0)}% (pull ~ current^2 across a large gap)`);

// 12. Settings
heading('12. Recommended GRBL settings');
table([
  ['setting', 'value'],
  ['$5', 0],
  ['$100, $101', fix(stepsPerMm, 0)],
  ['$110, $111', MOTION.maxRate],
  ['$120, $121', MOTION.accel],
  ['$11', fix(MOTION.junctionDeviation, 3)],
  ['$20', 1],
  ['$22', 1],
  ['$23', '3 if the switches are at the X-min and Y-min ends'],
  ['$25', HOMING.seekRate],
  ['$130, $131', '380, 300 or more'],
]);
out('  firmware: stock GRBL 1.1 homes Z first (config.h HOMING_CYCLE_0 (1<<Z_AXIS)) and alarms with no Z switch;');
out('    build it with #define HOMING_CYCLE_0 ((1<<X_AXIS)|(1<<Y_AXIS)) and HOMING_CYCLE_1 commented out');
const seekTime = (HOMING.travel / HOMING.seekRate) * 60;
const locateTime = (HOMING.pulloff / HOMING.feedRate) * 60;
const pulloffTime = 2 * (HOMING.pulloff / HOMING.seekRate) * 60;
const debounceTime = HOMING.phases * HOMING.debounce;
const homingTime = seekTime + locateTime + pulloffTime + debounceTime;
out(`  homing from the far end: seek ${HOMING.travel} mm at $25 = ${HOMING.seekRate}: ${fix(seekTime, 1)} s (${fix((HOMING.travel / 500) * 60, 0)} s at the default 500)`);
out(`    + locate ${HOMING.pulloff} mm at $24 = ${HOMING.feedRate}: ${fix(locateTime, 1)} s + two ${HOMING.pulloff} mm pull-offs: ${fix(pulloffTime, 2)} s + ${HOMING.phases} pauses of $26 = ${HOMING.debounce * 1000} ms: ${fix(debounceTime, 1)} s`);
out(`    = ${fix(homingTime, 1)} s`);

console.log(lines.join('\n').trimStart());
