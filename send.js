/*
 * Sends a G-code file to the gantry's GRBL controller over USB, one line at
 * a time, and stops at the first error or alarm.
 *
 *   node send.js plan.gcode --port /dev/ttyUSB0 [--baud 115200] [--home | --no-home]
 *   node send.js plan.gcode --dry-run      show what would be sent, no port
 *   node send.js --list                    list serial ports
 *
 * Opening the port usually resets the Arduino (an Uno restarts when DTR
 * switches on), which clears GRBL's position. With homing on ($22=1, the v1
 * setting) GRBL then waits to be homed, so give --home: it homes ($H)
 * before the job. If GRBL does not ask to be homed (homing off, or a board
 * that did not reset), send.js refuses to start unless --home or --no-home
 * says what to do.
 *
 * Ctrl-C stops the job: a feed hold, then a reset once the carriage has
 * stopped. The reset switches the magnet off, and the piece being moved
 * stays wherever it was. A second Ctrl-C resets GRBL at once and quits.
 *
 * Needs the serialport package (npm install); --dry-run works without it.
 * The protocol lives in src/grbl.js and the job's steps in src/send-job.js.
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

import { GrblError, prepareGcode } from './src/grbl.js';
import { createJob } from './src/send-job.js';

const USAGE = `Usage: node send.js plan.gcode --port /dev/ttyUSB0 [--baud 115200] [--home | --no-home] [--dry-run]
       node send.js --list`;
const VALUE_FLAGS = ['--port', '--baud'];
const SWITCHES = ['--home', '--no-home', '--dry-run', '--list', '--help', '-h'];

function fail(message, code = 2) {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(code);
}

// Strict parsing: a mistyped flag such as --dryrun must not send for real.
const args = process.argv.slice(2);
const given = {};
const files = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (SWITCHES.includes(arg)) given[arg] = true;
  else if (VALUE_FLAGS.includes(arg)) {
    if (i + 1 >= args.length) fail(`${arg} needs a value.`);
    given[arg] = args[++i];
  } else if (arg.startsWith('-')) fail(`Unknown option "${arg}".`);
  else files.push(arg);
}

if (given['--help'] || given['-h']) {
  console.log(USAGE);
  process.exit(0);
}

async function loadSerialPort() {
  try {
    return (await import('serialport')).SerialPort;
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('send.js needs the serialport package, which is not installed. Run "npm install" in this folder and try again.');
      console.error('(node send.js plan.gcode --dry-run works without it.)');
    } else {
      console.error(`Could not load the serialport package: ${err.message}`);
      console.error('Try "npm rebuild serialport", or reinstall with "npm install".');
    }
    process.exit(1);
  }
}

if (given['--list']) {
  const SerialPort = await loadSerialPort();
  const ports = await SerialPort.list();
  if (ports.length === 0) console.log('No serial ports found. Is the Arduino plugged in?');
  for (const port of ports) console.log(`${port.path}${port.manufacturer ? `  (${port.manufacturer})` : ''}`);
  process.exit(0);
}

if (files.length !== 1) fail(files.length ? 'Give one G-code file.' : 'Give the G-code file to send.');
const file = files[0];
const baudRate = Number(given['--baud'] ?? 115200);
if (!Number.isInteger(baudRate) || baudRate <= 0) fail('--baud must be a whole number, for example 115200.');
const home = Boolean(given['--home']);
const noHome = Boolean(given['--no-home']);
if (home && noHome) fail('Give --home or --no-home, not both.');

let text;
try {
  text = readFileSync(file, 'utf8');
} catch (err) {
  console.error(`Could not read ${file}: ${err.message}`);
  process.exit(1);
}

let prepared;
try {
  prepared = prepareGcode(text);
} catch (err) {
  console.error(`${file}: ${err.message}`);
  process.exit(1);
}
const { lines, skipped } = prepared;
if (lines.length === 0) {
  console.error(`${file} has no G-code to send.`);
  process.exit(1);
}

if (given['--dry-run']) {
  console.log('Dry run: no port is opened and nothing is sent.');
  console.log(`${file}: ${lines.length} line${lines.length === 1 ? '' : 's'} to send (${skipped} comment or blank line${skipped === 1 ? '' : 's'} left out).\n`);
  const width = String(lines.length).length;
  const blank = ' '.repeat(width);
  if (home) console.log(`${blank}  $H                ; home first (--home)`);
  let note = '';
  lines.forEach((line, i) => {
    if (line.note && line.note !== note) {
      note = line.note;
      console.log(`${blank}  ; ${note}`);
    }
    console.log(`${String(i + 1).padStart(width)}  ${line.text}`);
  });
  console.log(`${blank}  G4 P0             ; added: GRBL answers it once the last move has finished`);
  process.exit(0);
}

if (!given['--port']) {
  fail('Give the serial port with --port, for example /dev/ttyUSB0 or /dev/ttyACM0 (Linux, Raspberry Pi), /dev/cu.usbmodem14101 (Mac) or COM3 (Windows). node send.js --list shows the ports.');
}
const path = given['--port'];

const SerialPort = await loadSerialPort();
const serial = new SerialPort({ path, baudRate, autoOpen: false });
try {
  await new Promise((resolve, reject) => serial.open((err) => (err ? reject(err) : resolve())));
} catch (err) {
  console.error(`Could not open ${path}: ${err.message}`);
  console.error('node send.js --list shows the ports. Close any other program using it (a G-code sender, the Arduino IDE serial monitor).');
  process.exit(1);
}

const link = {
  write: (data) =>
    new Promise((resolve, reject) => {
      serial.write(data, 'latin1', (err) => (err ? reject(err) : resolve()));
    }),
  onData: (callback) => {
    const handler = (chunk) => callback(chunk.toString('latin1'));
    serial.on('data', handler);
    return () => serial.off('data', handler);
  },
};

const tty = process.stdout.isTTY;
let progressShown = false;
function clearProgress() {
  if (tty && progressShown) process.stdout.write('\r\x1b[K');
  progressShown = false;
}
function say(message) {
  clearProgress();
  console.log(message);
}

let lastNote = '';
function progress(p) {
  if (p.phase === 'home') return say('Homing ($H)...');
  if (p.phase === 'finish') return say('All lines sent; waiting for the last move to finish...');
  const label = `[${String(p.sent).padStart(String(p.total).length)}/${p.total}] ${String(Math.floor((100 * p.sent) / p.total)).padStart(3)}%`;
  if (tty) {
    const line = `${label}  ${p.line.note}`.slice(0, (process.stdout.columns || 80) - 1);
    process.stdout.write(`\r\x1b[K${line}`);
    progressShown = true;
  } else if (p.line.note !== lastNote) {
    console.log(`${label}  ${p.line.note}`);
  }
  lastNote = p.line.note;
}

const job = createJob(link, { say, onProgress: progress });
serial.on('close', () => job.grbl.abort(new GrblError('closed', 'The serial port closed. Was the USB cable unplugged?')));
serial.on('error', (err) => job.grbl.abort(new GrblError('closed', `Serial port error: ${err.message}`)));

function closePort() {
  return new Promise((resolve) => {
    if (!serial.isOpen) return resolve();
    serial.close(() => resolve());
  });
}

// The first Ctrl-C asks the job to stop; run() below returns once the
// reset has gone out. A second one (or one outside the job) resets GRBL
// at once, mid-move or not, and quits.
let interrupts = 0;
process.on('SIGINT', () => {
  interrupts++;
  if (interrupts === 1 && job.running) {
    job.stop();
    return;
  }
  say('\nResetting GRBL now. If it was moving it loses its position: run again with --home.');
  const quit = () => process.exit(130);
  setTimeout(quit, 500);
  try {
    serial.write('\x18', quit);
  } catch {
    quit();
  }
});

say(`Opened ${path} at ${baudRate} baud. Waiting for GRBL to start...`);
const exitCode = await job.run(lines, { home, noHome });
job.close();
await closePort();
process.exit(exitCode);
