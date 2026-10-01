export const meta = {
  name: 'robotic-chessboard-design-push',
  description: 'Source the BOM, CAD the gantry and assembly, draw the schematic, write calculations and the GRBL sender, each reviewed and fixed',
  phases: [
    { title: 'Build', detail: 'one agent per work track' },
    { title: 'Review', detail: 'independent reviewers / per-item link verification' },
    { title: 'Fix', detail: 'apply review findings' },
  ],
}

// Run with args { repo: '<absolute path of the clone>' } if it isn't /home/user/robotic-chessboard.
const REPO = (args && args.repo) || '/home/user/robotic-chessboard'
const SCRATCH = (args && args.scratch) || '/tmp/chessboard-wf'

const CTX = `
You are working on a hardware project repo at ${REPO}: a self-moving chessboard ("Ghost Gambit"). An electromagnet on an XY gantry slides under the board top and drags 3D-printed chess pieces (steel M8 washer glued in each base). Read these first: README.md, docs/DESIGN.md, docs/BOM.md, ROADMAP.md, cad/pieces.scad, cad/make-board.js, src/gcode.js.

Fixed design facts (v1, funded on a $100 parts budget):
- 40 mm squares; grid 10 x 8 cells = 8x8 board + 1 storage column each side; printed surface 400 x 320 mm.
- Magnet must reach every cell center: 360 x 280 mm of travel between outermost centers. G-code coordinates: cell (x,y) center = ((x+0.5)*40 + offsetX, (y+0.5)*40 + offsetY) mm, x from the left storage column, y from rank 1.
- Pieces: 19 mm bases, 21.5-31.5 mm tall, M8 washer (16 mm OD, 8.4 mm ID, 1.6 mm thick) in base, felt pad under it.
- Motion: 2x NEMA 17 (42.3 mm square, 31 mm M3 hole pattern, 22 mm boss, 5 mm shaft), GT2 6 mm belt, 20T pulleys (5 mm bore), 20T idlers (3 mm bore), 4x 8 mm x 500 mm smooth rods, LM8UU bearings (15 mm OD, 24 mm long), 2 mechanical endstops.
- Magnet: 12 V holding electromagnet P20/15 type (20 mm dia x 15 mm, threaded hole in the back, ~0.25 A). Spring-loaded so its face (PTFE tape) presses lightly against the underside of the 3 mm board top; constant gap regardless of sag.
- Electronics: Arduino Uno + CNC Shield V3 (A4988, 1/16 microstepping) running GRBL 1.1; logic-level MOSFET module (AOD4184 type: VIN+/VIN- power in, OUT+/OUT- load, TRIG/PWM + GND signal) driven from the shield's CoolEn pin (Arduino A3, GRBL M8 on / M9 off); 1N5819 across the coil (cathode/stripe to +12 V); 12 V 5 A supply with 5 A inline fuse; endstops on X- / Y- pins wired normally-open between signal and GND.
- Base: plywood/MDF about 600 x 500 mm. Board top: 3 mm hardboard on a frame above the gantry, supported only outside the moving envelope.
- Printer assumed: 220 x 220 mm bed, PLA, prefer support-free parts.

Tools available in this container: node 22, openscad at /usr/bin/openscad (PNG renders need "xvfb-run -a openscad ..."), python3, Playwright for Chromium (load with require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); chromium is preinstalled; file:// pages work; Google Fonts are blocked). Web search/fetch tools can be loaded with ToolSearch ("select:WebSearch,WebFetch"). Put scratch files under ${SCRATCH} (mkdir -p it), not in the repo.

Rules:
- Only create or edit the files your task names. Do NOT edit README.md, ROADMAP.md, docs/DESIGN.md or docs/BOM.md (the coordinator integrates those).
- Do NOT git commit, push, or change branches.
- Match the repo style: JS uses ES modules, semicolons, single quotes, 2-space indent, a block comment at the top of each file explaining it; plain clear names. Docs: plain direct English, no hype.
- Never invent facts: if you could not verify something, say so in your output.
`

const BUILD = {
  type: 'object',
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    checks: { type: 'string', description: 'what you ran to verify and the results' },
    openIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['files', 'summary', 'checks', 'openIssues'],
}

const REVIEW = {
  type: 'object',
  properties: {
    verdict: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          file: { type: 'string' },
          problem: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['severity', 'problem', 'fix'],
      },
    },
  },
  required: ['verdict', 'findings'],
}

const BOM = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          part: { type: 'string' },
          purpose: { type: 'string' },
          qty: { type: 'number' },
          unitPrice: { type: 'number' },
          vendor: { type: 'string' },
          link: { type: 'string' },
          priceSource: { type: 'string', enum: ['product page', 'search result', 'estimate'] },
          notes: { type: 'string' },
        },
        required: ['part', 'purpose', 'qty', 'unitPrice', 'vendor', 'link', 'priceSource', 'notes'],
      },
    },
    taxShipping: { type: 'number' },
    taxShippingNotes: { type: 'string' },
    alreadyOwned: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['items', 'taxShipping', 'taxShippingNotes', 'alreadyOwned', 'notes'],
}

const VERIFY = {
  type: 'object',
  properties: {
    pageReachable: { type: 'boolean' },
    specMatches: { type: 'boolean' },
    observedPrice: { type: 'number', description: '-1 if no price could be seen' },
    howChecked: { type: 'string' },
    issue: { type: 'string' },
    alternativeVendor: { type: 'string' },
    alternativeLink: { type: 'string' },
    alternativePrice: { type: 'number', description: '-1 if none' },
  },
  required: ['pageReachable', 'specMatches', 'observedPrice', 'howChecked', 'issue', 'alternativeVendor', 'alternativeLink', 'alternativePrice'],
}

const fixPrompt = (track, review) => `${CTX}
You are fixing the "${track}" work after an independent review. Re-read the files involved, then fix every blocker and major finding, and every minor one that is clearly right. If you disagree with a finding, leave it and explain why in openIssues. Re-run the relevant checks (tests, renders, scripts) after fixing.

Review findings (JSON):
${JSON.stringify(review, null, 2)}`

// ---------- Tracks ----------

async function bomTrack() {
  // A first research pass is saved in docs/bom-draft.md (about $21 over budget, prices unconfirmed).
  const research = await agent(`${CTX}
TASK: finish the real, orderable bill of materials for the v1 build. The builder types each row into a funding form that needs: part, what it's for, qty, unit price, vendor, link. The whole order INCLUDING estimated tax and shipping must be at or under $100 (US buyer).

Start from docs/bom-draft.md: 17 rows researched earlier, totalling about $120 with tax and shipping, every price from search results (two estimates), none confirmed on a product page. Read its notes, including the researcher's ideas for closing the gap. Your job:
- re-check every row with WebSearch/WebFetch (vendor pages may block fetches; then corroborate with searches for the exact listing) and replace any row that is dead, the wrong variant, or mispriced;
- get the total including tax and shipping to $100 or less, e.g. cheaper rods (the $25 row), the pen-spring option, combined kits, cheaper stores, without breaking the specs in docs/DESIGN.md and docs/bom-draft.md (carbon-steel washers, logic-level MOSFET module, P20/15 12 V magnet, 45 N.cm 1.5 A motors, LM8UU, 8 mm x 500 mm rods);
- only give links you actually saw; never construct URLs; record priceSource honestly;
- if $100 is truly impossible, return the cheapest honest list and say exactly how much over and what to drop.
Estimate tax+shipping for the whole order in taxShipping and explain in taxShippingNotes.`, { label: 'bom:finish', phase: 'Build', schema: BOM })
  if (!research) return { research: null, verdicts: [] }
  const verdicts = await parallel(research.items.map((item, i) => () =>
    agent(`You are verifying ONE row of a parts list for a hardware funding application. Be skeptical: default to reporting problems if you cannot confirm.
Row: ${JSON.stringify(item)}
Load WebFetch/WebSearch with ToolSearch ("select:WebSearch,WebFetch"). Try to open the link. Check: is it a real product page, does the product match the part/spec described, what price is shown (per unit, for the quantity needed)? If the page can't be fetched (vendors often block bots), search for the exact product to corroborate the listing and price, and say how you checked. If the item is wrong, overpriced, or unconfirmable, suggest an alternative real listing you actually saw (vendor, link, price); otherwise leave the alternative fields empty with alternativePrice -1.`, { label: `bom:verify ${i + 1} ${item.part.slice(0, 30)}`, phase: 'Review', schema: VERIFY })))
  return { research, verdicts }
}

async function cadTrack() {
  const build = await agent(`${CTX}
TASK: design the gantry and the full assembly in OpenSCAD, so reviewers can see the machine fits together.

Create:
1. cad/params.scad: every shared dimension in one place (grid, travel, rod/bearing/motor/pulley/magnet sizes, clearances such as 8.2 mm rod holes, LM8UU press-fit bore about 15.2 mm, M3 clearance 3.4 mm, wall thicknesses, heights of each layer of the stack).
2. cad/gantry-parts.scad: one module per printed part, selectable with a "part" variable (like cad/pieces.scad), plus "all" for a print-layout view: Y rod holders (to hold the 4 rod ends... design for 2 Y rods on the base, 4 holders), the 2 X-gantry end blocks (each carries 2 LM8UU on a Y rod, clamps both X rod ends; one carries the X motor, the other the X idler), the magnet carriage (rides the two X rods on LM8UU, has belt clamps, and a vertical sleeve with a spring pocket so the P20/15 magnet floats up against the board), Y motor mount and Y idler mount (on the base), belt clamp for the Y belt on an end block, and endstop mounts for X and Y. Use real hole patterns (NEMA 17: 31 mm M3 pattern, 22 mm boss clearance). Every part must fit a 220 x 220 bed and print without supports if at all possible.
3. cad/assembly.scad: the whole machine: base, Y rods, end blocks, X rods, carriage, magnet, motors (simple dimensioned stand-ins), belts (simple strips), the board-top frame/posts and the 3 mm top with the 400 x 320 printed area centered over the magnet's reach. Variables to place the carriage at any cell; include echo() checks proving the magnet center reaches the outermost cell centers (x 20..380, y 20..300 mm relative to the printed area's corner) with margin, that nothing collides with the board top, and that the frame supporting the top sits outside the moving envelope. Report the overall machine footprint and height.
4. cad/export.sh: exports every printed part to cad/stl/<name>.stl and renders images (xvfb-run -a openscad --render ...). Run it.
5. Renders (PNG, ~1400 px wide, clear camera angles, --colorscheme=Tomorrow or similar): docs/img/assembly.png (3/4 view, board top hidden or transparent so the gantry is visible), docs/img/assembly-top.png (top view showing the carriage at a corner cell), docs/img/section.png (side cross-section through the carriage showing base, rods, bearings, carriage, spring, magnet, board top: the stack-up), docs/img/gantry-parts.png (all printed parts laid out).
6. cad/README.md: what each file is, a table of printed parts (name, qty, approx print time if you can estimate from volume, orientation), assembly steps, and the key clearances.

Look at your renders (Read the PNGs) and iterate until the parts look right and the assembly fits. Keep the design simple and buildable by a student.`, { label: 'cad:build', phase: 'Build', schema: BUILD })
  const review = await agent(`${CTX}
You are an adversarial mechanical design reviewer. Another agent designed the gantry and assembly in cad/ (params.scad, gantry-parts.scad, assembly.scad, export.sh, README.md, stl/) with renders in docs/img/ (assembly.png, assembly-top.png, section.png, gantry-parts.png). Its report: ${JSON.stringify(build)}

Find real problems a builder would hit. Check, by reading the code, running openscad (echo output, STL export, renders), and measuring:
- hole sizes and fits (8 mm rods, LM8UU 15 mm x 24 mm, NEMA 17 pattern and boss, M3, pulley/idler clearances), wall thickness, printability on a 220 x 220 bed without supports;
- the magnet actually reaches every cell center (x 20..380, y 20..300 relative to the printed area) and the spring stack puts the magnet face against the board underside with preload;
- belts: paths are parallel to rods, pulleys/idlers aligned in height, clamps exist on the moving parts;
- interferences in the assembly; frame/posts outside the moving envelope; endstops actually triggered at the home corner;
- racking risk of a single-sided Y drive; X motor mass on the gantry;
- renders are clear and accurate; README matches the code.
Report concrete findings with the file and the fix.`, { label: 'cad:review', phase: 'Review', schema: REVIEW })
  const fix = review ? await agent(fixPrompt('CAD (gantry parts and assembly)', review), { label: 'cad:fix', phase: 'Fix', schema: BUILD }) : null
  return { build, review, fix }
}

async function softwareTrack() {
  const build = await agent(`${CTX}
TASK: write the software that connects the planner to the real machine.
1. src/grbl.js: a transport-independent GRBL 1.1 streamer. Given G-code text, strip comments (';' and '(...)') and blank lines, then send one line at a time and wait for 'ok' (simple send-response protocol), handling 'error:N' (stop and report the line), 'ALARM:N' (stop), the 'Grbl 1.1...' welcome banner, '[MSG:...]' and status reports, and a per-line timeout. Optional homing ('$H') first. It takes a port object with write(text) and an onData-style line callback, so it can be unit-tested with a fake GRBL. Include human-readable meanings for common GRBL error/alarm codes (at least the ones a builder will hit: 2, 9, 20, 22, 24, ALARM 1, 2, 3, 8, 9).
2. send.js: CLI "node send.js plan.gcode --port /dev/ttyUSB0 [--baud 115200] [--home] [--dry-run]" using the 'serialport' npm package via dynamic import (install it with npm so it is in package.json dependencies; give a clear error message if it is missing). --dry-run prints what would be sent without a port. Show progress.
3. src/calibration.js + calibrate.js: from the machine coordinates the builder measured by jogging the magnet to the centers of a1 and h8 (and the board config: square size, storage columns), compute offsetX, offsetY, the actual square size on each axis and any small rotation of the board relative to the gantry; write calibration.json. "node calibrate.js --a1 X,Y --h8 X,Y [--square 40] [--storage 1]".
4. Extend src/gcode.js so toGcode accepts { calibration } (the object from calibration.json) applying scale, rotation and offset to every point, while keeping all existing options and output unchanged when no calibration is given. Add "--calibration calibration.json" to demo.js.
5. Tests in tests/ (node --test): fake-GRBL streaming (ok, error, alarm, timeout, comments/blank lines skipped, homing first), calibration math (round trip: a known offset/scale/rotation is recovered from a1/h8 measurements), gcode with calibration. "npm test" must pass WITHOUT serialport being importable by the tests (tests must not import send.js) and must not need network or hardware.
6. Add npm scripts "send" and "calibrate" to package.json. Do not touch README/DESIGN/ROADMAP/BOM.
Run npm test and the CLIs (dry run, calibrate) and report results.`, { label: 'software:build', phase: 'Build', schema: BUILD })
  const review = await agent(`${CTX}
You are an adversarial code reviewer for the machine-control software just added: src/grbl.js, send.js, src/calibration.js, calibrate.js, changes to src/gcode.js and demo.js, new tests, package.json. Report: ${JSON.stringify(build)}
Look for real bugs: GRBL protocol mistakes (e.g. lines GRBL won't answer, buffer/line-length limits of 80 chars in GRBL's serial line buffer, responses arriving split across data chunks, waiting for the welcome banner after the Arduino resets on port open, handling of '$H' taking a long time, timeouts too short for long moves, error codes wrong), calibration math errors (rotation sign, which axis is which, a1/h8 cell coordinates for 1 vs 2 storage columns), backwards-compatibility breaks in toGcode (run the existing tests), CLI argument bugs, tests that don't actually test the behavior. Run things to confirm each finding before reporting it. Report concrete findings with file and fix.`, { label: 'software:review', phase: 'Review', schema: REVIEW })
  const fix = review ? await agent(fixPrompt('machine-control software', review), { label: 'software:fix', phase: 'Fix', schema: BUILD }) : null
  return { build, review, fix }
}

async function calcTrack() {
  const build = await agent(`${CTX}
TASK: write docs/CALCULATIONS.md (engineering calculations) backed by scripts/calculations.js which computes and prints every number (the doc must match the script output). Cover, with formulas, inputs, and conclusions:
- steps/mm for GT2 + 20T pulley at 1/16 (and 1/8), resolution per step;
- step-rate limit of GRBL on an Uno (~30 kHz) => max feed; chosen $110/$111 and why; realistic stepper torque margin for the moving masses (estimate masses of carriage, gantry incl. X motor, piece);
- piece mass from the actual geometry: compute each piece's volume from STL exports of cad/pieces.scad (export them to scratch with openscad, compute volume from the triangles in the script or a helper), PLA at a stated infill, plus the M8 washer; center of gravity height estimate;
- tipping: the magnet pulls at the base (and downward), so derive the acceleration at which the tallest piece (king) tips, with and without the magnet's downward pull; compare to $120/$121 = 400 mm/s^2;
- slipping/lagging: lateral force needed to accelerate and drag a piece over felt (state the friction coefficient assumption) vs a conservative estimate of the electromagnet's lateral grip through the gap (state assumptions clearly as estimates to be measured in Milestone 1);
- 8 mm rod deflection at mid-span under the carriage weight plus the spring preload reaction;
- belt lengths for X and Y loops vs the 5 m roll;
- power budget and electromagnet duty/heat (only on while dragging; estimate duty cycle from the planner's sample jobs: run node demo.js reset --storage 1 --square 40 --size 0.475 and use drag vs travel distances and feeds);
- time to complete the 22-move reset job at the chosen feeds/accelerations (estimate).
Every assumption labelled as an assumption. Conclude with the recommended GRBL settings table.`, { label: 'calc:build', phase: 'Build', schema: BUILD })
  const review = await agent(`${CTX}
You are an independent checker for docs/CALCULATIONS.md and scripts/calculations.js. Report: ${JSON.stringify(build)}
Recompute every number yourself independently (do not trust the script): unit conversions, formulas (steps/mm, step rate, tipping criterion with downward magnetic force, friction, simply-supported beam deflection with I = pi d^4 / 64, belt lengths, duty cycle), and whether conclusions follow. Run the script and confirm the doc matches its output. Flag any physics mistakes, unlabelled assumptions or overconfident claims. Concrete findings with fix.`, { label: 'calc:review', phase: 'Review', schema: REVIEW })
  const fix = review ? await agent(fixPrompt('engineering calculations', review), { label: 'calc:fix', phase: 'Fix', schema: BUILD }) : null
  return { build, review, fix }
}

async function schematicTrack() {
  const build = await agent(`${CTX}
TASK: draw a proper wiring schematic for the electronics, generated from code so it can be regenerated: cad/make-wiring.js writes docs/img/wiring.svg and renders docs/img/wiring.png (use Playwright/Chromium to screenshot the SVG at about 1600 px wide). Draw it like a clean schematic, not a block diagram: labelled components with their actual terminals: 12 V supply (+V, -V), inline 5 A fuse, CNC Shield V3 (power screw terminal, X and Y driver sockets with A4988, X/Y motor headers 2B 2A 1A 1B, endstop header pins X-/Y- with signal and GND, CoolEn pin = A3 and a GND pin, USB via the Uno), the two NEMA 17 motors (coil A pair and coil B pair), two NO endstop switches (C and NO used), the AOD4184-type MOSFET module (VIN+, VIN-, OUT+, OUT-, TRIG/PWM, GND), the electromagnet with the 1N5819 across it (cathode/stripe toward +12 V, anode to OUT-), and the laptop/Pi on USB. Wire colors: red +12 V, black GND, others distinct; junction dots; net labels; a small notes box (12 V only, set A4988 Vref, microstep jumpers in for 1/16, diode orientation). Make it readable at a glance. Then Read the PNG and iterate until it is clean (no overlapping labels or wires crossing text).`, { label: 'schematic:build', phase: 'Build', schema: BUILD })
  const review = await agent(`${CTX}
You are an electrical reviewer. Check cad/make-wiring.js and its output docs/img/wiring.svg / wiring.png (Read the PNG). Report: ${JSON.stringify(build)}
Verify electrical correctness: power polarity, the fuse on the +12 V line before everything, shared grounds, MOSFET module wiring (load on OUT+/OUT-, power on VIN+/VIN-, signal TRIG/PWM to CoolEn/A3 and GND to shield GND), flyback diode orientation (cathode to +12 V side of the coil), endstops wired NO to signal and GND on the correct header pins for GRBL 1.1 on a CNC Shield V3 (X- uses D9, Y- uses D10), motor coil pairing, CoolEn really being A3 on CNC Shield V3. Also readability: overlapping text, wires through labels, legibility. Concrete findings with fix.`, { label: 'schematic:review', phase: 'Review', schema: REVIEW })
  const fix = review ? await agent(fixPrompt('wiring schematic', review), { label: 'schematic:fix', phase: 'Fix', schema: BUILD }) : null
  return { build, review, fix }
}

const [bom, cad, software, calc, schematic] = await parallel([
  () => bomTrack(),
  () => cadTrack(),
  () => softwareTrack(),
  () => calcTrack(),
  () => schematicTrack(),
])

return { bom, cad, software, calc, schematic }
