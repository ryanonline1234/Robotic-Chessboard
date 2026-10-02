/*
 * Draws the wiring schematic for the v1 board:
 *   docs/img/wiring.svg  the schematic as plain SVG
 *   docs/img/wiring.png  a 2x render of it (3200 px wide), for the docs
 *
 *   node cad/make-wiring.js
 *
 * The PNG is rendered with Playwright's Chromium. Playwright is not a
 * dependency of this repo: install it wherever you like and point
 * PLAYWRIGHT_MODULE at it (for example /path/to/node_modules/playwright).
 * Without it, only the SVG is written.
 *
 * Positions are SVG pixels. The layout is placed by hand so that no wire
 * crosses another wire or any text: +12 V runs along the top, ground along
 * the bottom, and each part hangs off the shield on the side its pins are on.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const W = 1600;

const COLOR = {
  v12: '#d7261e', // +12 V
  gnd: '#1b1b1b', // ground
  coilA: '#16a34a', // motor coil A, driver pins 1A / 1B
  coilB: '#2563eb', // motor coil B, driver pins 2A / 2B
  xLimit: '#ea7a00', // X endstop signal
  yLimit: '#0e9aa7', // Y endstop signal
  coolEn: '#db2777', // magnet on/off signal
  magnet: '#7c3aed', // switched magnet leads
  usb: '#8a93a3',
  ink: '#1f2937',
  muted: '#5b6472',
  part: '#f7f9fc',
  inner: '#e9eef5',
};

const POWER = 3.5; // wire widths
const SIGNAL = 2.5;
const USB_WIDTH = 6;

// ---------------------------------------------------------------- drawing helpers

const boxes = [];
const symbols = [];
const wires = [];
const marks = [];
const labels = [];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function text(x, y, str, { size = 12, weight = 400, anchor = 'start', fill = COLOR.ink } = {}) {
  labels.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${esc(str)}</text>`);
}

function lines(x, y, rows, options = {}) {
  const step = options.step ?? (options.size ?? 12) + 4;
  rows.forEach((row, i) => text(x, y + i * step, row, options));
}

// A component outline. Inner boxes (terminal block, driver sockets) get a darker fill.
function box(x, y, w, h, { fill = COLOR.part, dash = false, radius = 6 } = {}) {
  boxes.push(`<rect class="part" x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${COLOR.ink}" stroke-width="1.6"${dash ? ' stroke-dasharray="6 4"' : ''}/>`);
}

function wire(color, width, ...points) {
  const pts = points.map(([x, y]) => `${x},${y}`).join(' ');
  wires.push(`<polyline class="wire" points="${pts}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`);
}

// A terminal on a component's edge.
function pin(x, y) {
  marks.push(`<circle cx="${x}" cy="${y}" r="3.6" fill="#fff" stroke="${COLOR.ink}" stroke-width="1.5"/>`);
}

// A junction: wires that meet at a dot are connected.
function dot(x, y, color) {
  marks.push(`<circle cx="${x}" cy="${y}" r="5.5" fill="${color}"/>`);
}

// A net name, written beside its wire in the wire's colour.
function net(x, y, name, color, anchor = 'middle') {
  text(x, y, name, { size: 12, weight: 700, anchor, fill: color });
}

function line(x1, y1, x2, y2, width = 2) {
  symbols.push(`<line class="sym" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLOR.ink}" stroke-width="${width}"/>`);
}

// A vertical coil from y1 down to y2, bumps bulging to the right.
function coil(x, y1, y2, bumps, lead = 0) {
  const r = (y2 - y1 - 2 * lead) / (2 * bumps);
  let d = `M ${x} ${y1} L ${x} ${y1 + lead}`;
  for (let i = 0; i < bumps; i++) d += ` a ${r} ${r} 0 0 1 0 ${2 * r}`;
  d += ` L ${x} ${y2}`;
  symbols.push(`<path class="sym" d="${d}" fill="none" stroke="${COLOR.ink}" stroke-width="2"/>`);
}

// ---------------------------------------------------------------- layout

const RAIL_V12 = 110; // +12 V runs along the top

// CNC shield, with the Uno under it.
const SH = { x: 480, y: 160, w: 520, h: 600 };
const SH_R = SH.x + SH.w;
const SH_B = SH.y + SH.h;
const SHIELD_PLUS = 290;
const SHIELD_MINUS = 330;
const X_HEADER = [215, 245, 275, 305]; // 2B 2A 1A 1B on the right edge
const Y_HEADER = [375, 405, 435, 465];
const COOLEN = SH_B - 130; // CoolEn row, right edge
const COOLEN_GND = COOLEN + 40;
const USB = SH_B - 70; // the Uno's USB port, left edge
// Endstop header, bottom edge: two rows of the shield's pin strip, each a
// signal pin (X- or Y-) and the GND pin beside it.
const X_STOP = 720;
const Y_STOP = 880;
const STOP_TOP = SH_B + 60;
const RAIL_GND = STOP_TOP + 120; // ground runs along the bottom

// Supply and fuse.
const PSU = { x: 60, y: 190, w: 240, h: 110 };
const PSU_PLUS_X = 240;
const PSU_MINUS_X = 100;
const SPLIT_V12 = 440; // where +12 V leaves the rail for the shield
const SPLIT_GND = SHIELD_MINUS; // where ground splits below the supply

// Motors.
const MOTOR_X = 1110;
const MOTOR_W = 250;

// MOSFET module, magnet and diode.
const MOS = { x: 1110, y: COOLEN - 60, w: 230, h: 200 };
const MOS_R = MOS.x + MOS.w;
const MOS_B = MOS.y + MOS.h;
const VIN_PLUS_X = 1300;
const VIN_MINUS_X = 1180;
const OUT_PLUS = COOLEN;
const OUT_MINUS = COOLEN + 90;
const DIODE_X = 1400;
const MAGNET_X = 1530;
const RIGHT_DROP = 1580; // +12 V comes down the right-hand margin to the module
const DROP_TURN = MOS.y - 40;

const NOTES_TOP = RAIL_GND + 42;
const NOTE_STEP = 17; // line spacing in the notes box

// ---------------------------------------------------------------- title

text(40, 42, 'Robotic Chessboard v1: wiring schematic', { size: 24, weight: 700 });
text(40, 66, 'Arduino Uno + CNC Shield V3 running GRBL 1.1, two NEMA 17 steppers, a 12 V electromagnet. 12 V DC only. Drawn by cad/make-wiring.js.', { size: 13, fill: COLOR.muted });

// ---------------------------------------------------------------- supply, fuse and power wiring

box(PSU.x, PSU.y, PSU.w, PSU.h);
text(180, 232, '12 V 3 A (or 5 A) supply', { size: 14, weight: 700, anchor: 'middle' });
text(180, 250, 'enclosed adapter, DC output', { size: 12, anchor: 'middle', fill: COLOR.muted });
text(180, 269, 'plug cut off? find +V with a meter', { size: 12, anchor: 'middle', fill: COLOR.muted });
text(PSU_PLUS_X, PSU.y + 18, '+V', { size: 12, weight: 700, anchor: 'middle' });
text(PSU_MINUS_X, PSU.y + PSU.h - 8, '−V', { size: 12, weight: 700, anchor: 'middle' });
pin(PSU_PLUS_X, PSU.y);
pin(PSU_MINUS_X, PSU.y + PSU.h);

// +V goes through F1 (the red wire runs through the fuse body) to the top
// rail, then down the right-hand margin to the MOSFET module.
wire(COLOR.v12, POWER, [PSU_PLUS_X, PSU.y], [PSU_PLUS_X, RAIL_V12], [RIGHT_DROP, RAIL_V12], [RIGHT_DROP, DROP_TURN], [VIN_PLUS_X, DROP_TURN], [VIN_PLUS_X, MOS.y]);
symbols.push(`<rect class="sym" x="${PSU_PLUS_X - 8}" y="126" width="16" height="44" fill="none" stroke="${COLOR.ink}" stroke-width="1.8"/>`);
text(PSU_PLUS_X + 18, 144, 'F1', { size: 13, weight: 700 });
text(PSU_PLUS_X + 18, 160, '5 A inline fuse', { size: 12 });
net(760, RAIL_V12 - 8, '+12 V (after the fuse)', COLOR.v12);
net(1440, DROP_TURN - 8, '+12 V', COLOR.v12);

// +12 V to the shield's power terminal.
wire(COLOR.v12, POWER, [SPLIT_V12, RAIL_V12], [SPLIT_V12, SHIELD_PLUS], [SH.x, SHIELD_PLUS]);
dot(SPLIT_V12, RAIL_V12, COLOR.v12);

// Ground: supply -V to the shield, and down the left margin along the bottom
// rail to the MOSFET module.
wire(COLOR.gnd, POWER, [PSU_MINUS_X, PSU.y + PSU.h], [PSU_MINUS_X, SPLIT_GND], [SH.x, SPLIT_GND]);
wire(COLOR.gnd, POWER, [PSU_MINUS_X, SPLIT_GND], [PSU_MINUS_X, RAIL_GND], [VIN_MINUS_X, RAIL_GND], [VIN_MINUS_X, MOS_B]);
dot(PSU_MINUS_X, SPLIT_GND, COLOR.gnd);
net(380, SPLIT_GND - 8, 'GND', COLOR.gnd);
net(640, RAIL_GND + 20, 'GND', COLOR.gnd);

// ---------------------------------------------------------------- CNC shield on the Uno

box(SH.x, SH.y, SH.w, SH.h);
text(500, 190, 'CNC Shield V3', { size: 18, weight: 700 });
text(500, 209, 'plugged onto the Arduino Uno', { size: 12, fill: COLOR.muted });

// Power screw terminal.
box(SH.x, SHIELD_PLUS - 24, 92, 84, { fill: COLOR.inner, radius: 3 });
text(SH.x + 8, SHIELD_PLUS - 31, 'POWER IN (screw terminal)', { size: 12, weight: 700, fill: COLOR.muted });
text(SH.x + 12, SHIELD_PLUS + 5, '+  12 V', { size: 13, weight: 700 });
text(SH.x + 12, SHIELD_MINUS + 5, '−  GND', { size: 13, weight: 700 });
pin(SH.x, SHIELD_PLUS);
pin(SH.x, SHIELD_MINUS);

// Driver sockets and their motor headers.
function driver(axis, top, header) {
  box(720, top, 210, 128, { fill: COLOR.inner, radius: 4 });
  text(825, top + 24, `${axis} driver socket`, { size: 13, weight: 700, anchor: 'middle' });
  text(825, top + 42, 'A4988 driver', { size: 12, anchor: 'middle' });
  text(825, top + 70, 'jumpers M0, M1, M2: all in', { size: 12, anchor: 'middle' });
  text(825, top + 86, '= 1/16 microstepping', { size: 12, anchor: 'middle' });
  text(825, top + 112, 'set Vref before use', { size: 12, anchor: 'middle', fill: COLOR.muted });
  text(992, header[0] - 13, `${axis} motor`, { size: 12, weight: 700, anchor: 'end', fill: COLOR.muted });
  ['2B', '2A', '1A', '1B'].forEach((name, i) => {
    text(990, header[i] + 4, name, { size: 12, weight: 700, anchor: 'end' });
    pin(SH_R, header[i]);
  });
}
driver('X', X_HEADER[0] - 19, X_HEADER);
driver('Y', Y_HEADER[0] - 19, Y_HEADER);
text(825, Y_HEADER[3] + 47, 'Z and A sockets: empty', { size: 12, anchor: 'middle', fill: COLOR.muted });

// The Uno underneath: GRBL's pin map and the USB port.
const UNO = { x: 496, y: SH_B - 240, w: 180, h: 222 };
box(UNO.x, UNO.y, UNO.w, UNO.h, { fill: '#fff', dash: true, radius: 4 });
text(UNO.x + 12, UNO.y + 24, 'Arduino Uno R3', { size: 13, weight: 700 });
text(UNO.x + 12, UNO.y + 40, 'under the shield', { size: 12, fill: COLOR.muted });
text(UNO.x + 12, UNO.y + 66, 'GRBL 1.1 pins used:', { size: 12, weight: 700 });
[['D9', 'X limit (X−)'], ['D10', 'Y limit (Y−)'], ['A3', 'CoolEn (magnet)']].forEach(([name, use], i) => {
  text(UNO.x + 12, UNO.y + 84 + i * 16, name, { size: 12, weight: 700 });
  text(UNO.x + 46, UNO.y + 84 + i * 16, use, { size: 12 });
});
text(UNO.x + 12, USB + 4, 'USB-B', { size: 12, weight: 700 });
pin(SH.x, USB);

// Endstop header on the bottom edge. On the shield these are two rows of one
// long two-column pin strip: X- and X+ are the same input (D9), so a switch
// across X- and X+ never triggers. Each outlined pair is one row.
lines(820, SH_B - 78, ['END STOP HEADER'], { size: 12, weight: 700, anchor: 'middle', fill: COLOR.muted });
lines(820, SH_B - 61, ['each switch on one row: the signal', 'pin and the pin beside it. Never X− to X+.'], { size: 12, anchor: 'middle', fill: COLOR.muted, step: 15 });
for (const x of [X_STOP, Y_STOP]) box(x - 20, SH_B - 26, 80, 26, { fill: COLOR.inner, radius: 3 });
[[X_STOP, 'X−'], [X_STOP + 40, 'GND'], [Y_STOP, 'Y−'], [Y_STOP + 40, 'GND']].forEach(([x, name]) => {
  text(x, SH_B - 9, name, { size: 12, weight: 700, anchor: 'middle' });
  pin(x, SH_B);
});

// CoolEn and a ground pin on the right edge.
text(992, COOLEN - 22, 'CoolEn row (same strip as the end stops)', { size: 12, weight: 700, anchor: 'end', fill: COLOR.muted });
text(990, COOLEN + 4, 'CoolEn (A3)', { size: 12, weight: 700, anchor: 'end' });
text(990, COOLEN_GND + 4, 'GND', { size: 12, weight: 700, anchor: 'end' });
pin(SH_R, COOLEN);
pin(SH_R, COOLEN_GND);

// ---------------------------------------------------------------- laptop

box(150, USB - 48, 250, 96);
text(275, USB - 20, 'Laptop or Raspberry Pi', { size: 14, weight: 700, anchor: 'middle' });
text(275, USB - 2, 'runs the planner and', { size: 12, anchor: 'middle' });
text(275, USB + 14, 'streams G-code to GRBL', { size: 12, anchor: 'middle' });
text(275, USB + 36, 'USB also powers the Uno', { size: 12, anchor: 'middle', fill: COLOR.muted });
wire(COLOR.usb, USB_WIDTH, [400, USB], [SH.x, USB]);
net(440, USB - 9, 'USB', COLOR.usb);
pin(400, USB);

// ---------------------------------------------------------------- stepper motors

function motor(axis, header) {
  const top = header[0] - 25;
  box(MOTOR_X, top, MOTOR_W, 140);
  const cx = MOTOR_X + 30;
  coil(cx, header[0], header[1], 3);
  coil(cx, header[2], header[3], 3);
  for (const y of header) line(MOTOR_X, y, cx, y);
  text(cx + 18, header[0] + 19, 'coil B', { size: 12, fill: COLOR.coilB, weight: 700 });
  text(cx + 18, header[2] + 19, 'coil A', { size: 12, fill: COLOR.coilA, weight: 700 });
  text(1290, top + 60, `${axis} motor`, { size: 15, weight: 700, anchor: 'middle' });
  text(1290, top + 78, 'NEMA 17 stepper', { size: 12, anchor: 'middle' });
  text(1290, top + 94, '4 wires, 2 coils', { size: 12, anchor: 'middle', fill: COLOR.muted });
  header.forEach((y, i) => {
    wire(i < 2 ? COLOR.coilB : COLOR.coilA, SIGNAL, [SH_R, y], [MOTOR_X, y]);
    pin(MOTOR_X, y);
  });
}
motor('X', X_HEADER);
motor('Y', Y_HEADER);

// ---------------------------------------------------------------- MOSFET module, magnet, diode

box(MOS.x, MOS.y, MOS.w, MOS.h);
text(1225, MOS.y + 122, 'MOSFET module', { size: 14, weight: 700, anchor: 'middle' });
text(1225, MOS.y + 139, 'AOD4184 type', { size: 12, anchor: 'middle', fill: COLOR.muted });
text(MOS.x + 8, COOLEN + 4, 'TRIG/PWM', { size: 12, weight: 700 });
text(MOS.x + 8, COOLEN_GND + 4, 'GND', { size: 12, weight: 700 });
text(VIN_PLUS_X, MOS.y + 18, 'VIN+', { size: 12, weight: 700, anchor: 'middle' });
text(VIN_MINUS_X, MOS_B - 9, 'VIN−', { size: 12, weight: 700, anchor: 'middle' });
text(MOS_R - 8, OUT_PLUS + 4, 'OUT+', { size: 12, weight: 700, anchor: 'end' });
text(MOS_R - 8, OUT_MINUS + 4, 'OUT−', { size: 12, weight: 700, anchor: 'end' });
for (const [x, y] of [[MOS.x, COOLEN], [MOS.x, COOLEN_GND], [VIN_PLUS_X, MOS.y], [VIN_MINUS_X, MOS_B], [MOS_R, OUT_PLUS], [MOS_R, OUT_MINUS]]) pin(x, y);

// Signal from the shield: CoolEn to TRIG/PWM, shield GND to the module's signal GND.
wire(COLOR.coolEn, SIGNAL, [SH_R, COOLEN], [MOS.x, COOLEN]);
wire(COLOR.gnd, SIGNAL, [SH_R, COOLEN_GND], [MOS.x, COOLEN_GND]);
net(1055, COOLEN - 8, 'CoolEn', COLOR.coolEn);
net(1055, COOLEN_GND - 8, 'GND', COLOR.gnd);

// Magnet coil between OUT+ and OUT-, with D1 across it.
wire(COLOR.magnet, SIGNAL, [MOS_R, OUT_PLUS], [MAGNET_X, OUT_PLUS]);
wire(COLOR.magnet, SIGNAL, [MOS_R, OUT_MINUS], [MAGNET_X, OUT_MINUS]);
wire(COLOR.magnet, SIGNAL, [DIODE_X, OUT_PLUS], [DIODE_X, OUT_MINUS]);
dot(DIODE_X, OUT_PLUS, COLOR.magnet);
dot(DIODE_X, OUT_MINUS, COLOR.magnet);
coil(MAGNET_X, OUT_PLUS, OUT_MINUS, 4, 13);
for (const dx of [17, 21]) line(MAGNET_X + dx, OUT_PLUS + 13, MAGNET_X + dx, OUT_MINUS - 13, 1.8); // iron core
// Diode: anode at the bottom (OUT-), cathode bar at the top (OUT+).
const mid = (OUT_PLUS + OUT_MINUS) / 2;
symbols.push(`<polygon class="sym" points="${DIODE_X - 11},${mid + 9} ${DIODE_X + 11},${mid + 9} ${DIODE_X},${mid - 9}" fill="${COLOR.ink}"/>`);
line(DIODE_X - 12, mid - 10, DIODE_X + 12, mid - 10, 3);
lines(DIODE_X + 18, mid - 14, ['D1 1N5819', 'stripe (cathode)', 'toward OUT+'], { size: 12, step: 15 });
net(1465, OUT_PLUS - 8, 'MAG+', COLOR.magnet);
net(1465, OUT_MINUS + 19, 'MAG−', COLOR.magnet);
text(1465, OUT_MINUS + 50, 'Electromagnet', { size: 14, weight: 700, anchor: 'middle' });
text(1465, OUT_MINUS + 67, '12 V, about 0.25 A, P20/15', { size: 12, anchor: 'middle' });

// ---------------------------------------------------------------- endstop switches

// A mechanical endstop board (RAMPS style): a micro switch on a small board
// with a 3-pin connector, S (signal), - and +. Makers wire the switch inside
// differently and put the pins in different orders, so the board is drawn as
// a box with its pin labels, not its inside. + stays unconnected: GRBL's own
// pull-up on the signal pin does that job. A bare 3-tab micro switch is in
// the notes.
function endstop(axis, x, signalColor, netName) {
  const top = STOP_TOP;
  box(x - 20, top, 130, 100);
  const [s, minus, plus] = [x, x + 40, x + 80];
  text(s, top + 19, 'S', { size: 12, weight: 700, anchor: 'middle' });
  text(minus, top + 19, '−', { size: 13, weight: 700, anchor: 'middle' });
  text(plus, top + 19, '+', { size: 13, weight: 700, anchor: 'middle' });
  // A small picture of the micro switch: body and lever.
  symbols.push(`<rect class="sym" x="${x + 17}" y="${top + 33}" width="56" height="15" rx="2" fill="#fff" stroke="${COLOR.ink}" stroke-width="1.6"/>`);
  line(x + 23, top + 32, x + 77, top + 25, 1.8);
  text(x + 45, top + 68, `${axis} endstop board`, { size: 13, weight: 700, anchor: 'middle' });
  text(x + 45, top + 86, '+ not connected', { size: 12, anchor: 'middle', fill: COLOR.muted });
  wire(signalColor, SIGNAL, [s, SH_B], [s, top]);
  wire(COLOR.gnd, SIGNAL, [minus, SH_B], [minus, top]);
  net(s - 7, SH_B + 34, netName, signalColor, 'end');
  for (const px of [s, minus, plus]) pin(px, top);
}
endstop('X', X_STOP, COLOR.xLimit, 'X_LIM');
endstop('Y', Y_STOP, COLOR.yLimit, 'Y_LIM');

// ---------------------------------------------------------------- notes and colour key

// Each note is a list of lines; lines after the first hang under the text.
const NOTES = [
  ['12 V DC only: the supply is an enclosed adapter, so there is no mains wiring. F1 goes on the +12 V lead, before anything else.'],
  [
    'If you cut off the barrel plug, find +12 V with a meter before connecting anything. The shield has no reverse-polarity protection:',
    'reversed 12 V destroys the drivers and shorts the supply through the MOSFET module and D1.',
  ],
  ['Set each A4988 current limit before plugging in its motor: Vref = 8 × Rsense × current (Rsense is printed on the driver, R100 = 0.1 Ω).'],
  ['Microstep jumpers M0, M1 and M2 all in under the X and Y drivers = 1/16 step, which is what GRBL $100 = $101 = 80 assumes.'],
  ['D1 stripe (cathode) to OUT+, plain end (anode) to OUT−. Backwards, it shorts the 12 V through the MOSFET when the magnet turns on.'],
  [
    'Endstop boards: S to X− (or Y−), − to the pin beside it, + not connected. Pin order varies by maker, so go by the printed labels.',
    'A 3-pin plug will not fit one row of the strip: move the S and − leads into single-pin housings.',
    'A bare micro switch works too: C to the pin beside X−, NO to X−, NC not connected.',
  ],
  [
    'Before homing, connect GRBL over USB and send ?. The reply must show Pn:X only while the X switch is held (the same for Y).',
    'If Pn:X shows with the switch released, set $5 = 1. If it never shows, check the wiring and the next note.',
  ],
  [
    'The pin beside each end stop must be GND. If your shield has an END STOP jumper (Protoneer V3.02 and later), set it so that,',
    'with everything unplugged, a meter on continuity beeps between the pin beside X− and the − power terminal.',
  ],
  [
    'Build GRBL to home X and Y only: in config.h set HOMING_CYCLE_0 to ((1<<X_AXIS)|(1<<Y_AXIS)) and comment out HOMING_CYCLE_1.',
    'Stock GRBL 1.1 homes Z first and stops with ALARM 9 when there is no Z switch.',
    'GRBL homes toward + by default ($23 = 0). If the switches sit at the a1 corner (the low end of X and Y), set $23 = 3.',
  ],
  ['Never plug or unplug a motor while the 12 V is on. Motor wire colours vary: find each coil pair with a meter (low ohms between them).'],
  ['If an axis runs backwards, swap the two wires of one coil, or invert that axis with GRBL $3.'],
];
const noteLines = NOTES.reduce((n, note) => n + note.length, 0);
const NOTES_H = 46 + noteLines * NOTE_STEP + 4;
box(40, NOTES_TOP, 1000, NOTES_H, { radius: 4 });
text(56, NOTES_TOP + 24, 'Notes', { size: 14, weight: 700 });
let noteY = NOTES_TOP + 46;
NOTES.forEach((note, i) => {
  text(56, noteY, `${i + 1}.`, { size: 12 });
  lines(76, noteY, note, { size: 12, step: NOTE_STEP });
  noteY += note.length * NOTE_STEP;
});

box(1070, NOTES_TOP, 490, NOTES_H, { radius: 4 });
text(1086, NOTES_TOP + 24, 'Wire colours', { size: 14, weight: 700 });
const KEY = [
  [COLOR.v12, '+12 V, after the fuse'],
  [COLOR.gnd, 'GND (all one net)'],
  [COLOR.coilB, 'motor coil B (2B, 2A)'],
  [COLOR.coilA, 'motor coil A (1A, 1B)'],
  [COLOR.magnet, 'magnet leads (OUT+, OUT−)'],
  [COLOR.coolEn, 'CoolEn (A3) to TRIG/PWM'],
  [COLOR.xLimit, 'X endstop signal (D9)'],
  [COLOR.yLimit, 'Y endstop signal (D10)'],
  [COLOR.usb, 'USB'],
];
KEY.forEach(([color, name], i) => {
  const x = 1086;
  const y = NOTES_TOP + 52 + i * 26;
  wire(color, color === COLOR.usb ? USB_WIDTH : POWER, [x, y - 4], [x + 30, y - 4]);
  text(x + 40, y, name, { size: 12 });
});

// ---------------------------------------------------------------- output

const H = NOTES_TOP + NOTES_H + 20;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="#ffffff"/>
${boxes.join('\n')}
${symbols.join('\n')}
${wires.join('\n')}
${marks.join('\n')}
${labels.join('\n')}
</svg>
`;

const out = new URL('../docs/img/', import.meta.url);
writeFileSync(new URL('wiring.svg', out), svg);
console.log('Wrote docs/img/wiring.svg');

let playwright = null;
try {
  playwright = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
} catch {
  console.log('Playwright not found, so wiring.png was not rendered. Set PLAYWRIGHT_MODULE to an installed copy of playwright.');
}
if (playwright) {
  try {
    const browser = await playwright.chromium.launch();
    // 2x, so the small labels stay sharp when the docs scale the image down
    // or a reader zooms in.
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`);
    await page.screenshot({ path: fileURLToPath(new URL('wiring.png', out)), clip: { x: 0, y: 0, width: W, height: H } });
    await browser.close();
    console.log(`Wrote docs/img/wiring.png (${2 * W} × ${2 * H} px)`);
  } catch (error) {
    console.error(`Could not render wiring.png: ${error.message}`);
    process.exitCode = 1;
  }
}
