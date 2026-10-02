# Engineering calculations (v1)

The numbers behind the v1 design in [DESIGN.md](DESIGN.md): resolution,
speed, motor torque, the pieces' mass and balance, whether the magnet can
drag them, frame sag, belt length, how long a reset takes, power and heat.

The figures are for the funded build in [BOM.md](BOM.md): no felt under the
pieces, a 12 V 3 A adapter, a generic 17HS4401 motor on X and a STEPPERONLINE
17HS15-1504S-X1 on Y. Where an optional add-back
([BOM.md: Add back when building](BOM.md#add-back-when-building)) changes a
figure, that case is worked too: felt pads in sections 4 to 7, the 5 A
adapter in section 11. The idlers (the belt kit's 5 mm-bore ones, or the
optional 3 mm-bore ones) are 20-tooth either way and change no figure here.

[`scripts/calculations.js`](../scripts/calculations.js) computes and prints
every figure in this document:

```bash
node scripts/calculations.js                          # uses the piece geometry recorded in the script
node scripts/calculations.js --export-stl /tmp/pieces # re-exports the pieces with OpenSCAD and re-measures them
node scripts/calculations.js --stl-dir /tmp/pieces    # re-measures STLs you already exported
```

`npm test` runs the script too ([tests/calculations.test.js](../tests/calculations.test.js))
and checks that the key figures quoted here still match what it prints. Some
of them come from other code: the reset job's time and magnet duty depend on
the planner and on the defaults in `src/gcode.js`. If a change moves one, the
test fails until this document is updated.

Every input is labelled:

- **design**: fixed by the v1 design ([DESIGN.md](DESIGN.md), [BOM.md](BOM.md), [cad/pieces.scad](../cad/pieces.scad), [src/gcode.js](../src/gcode.js))
- **source**: checked against a datasheet, a product listing or GRBL's source code (listed at the end)
- **assumption**: an estimate. The ones that change a conclusion are measured in Milestone 1 (see [What Milestone 1 should measure](#what-milestone-1-should-measure)).

## Results at a glance

| § | Check | Result | Verdict |
|---|---|---|---|
| 1 | Resolution | 80 steps/mm, 0.0125 mm per microstep | Far finer than the ±1 mm target |
| 2 | Top speed | `$110` = 6000 mm/min uses 27% of GRBL's step rate, and 24.5% (X) and 38.5% (Y) of each motor's rule-of-thumb roll-off speed. On Y's published curve the torque holds its peak up to 38.5% of that speed. Counting back-EMF (a rough check), Y's current stays controllable up to about 281 rpm, 1.9× the 150 rpm of 6000 | Comfortable on X. Y is at or a little past the end of its flat torque: fine at 6000, don't raise `$111` without testing |
| 3 | Motor torque | 3.48 N·cm needed on Y, 11.1 N·cm usable from its 45 N·cm motor; 3.25 N·cm needed on X, 9.9 N·cm usable from its 40 N·cm 17HS4401 | 3.2× margin on Y and 3.0× on X at 400 mm/s²; 2.8× and 2.9× at 1000 |
| 4 | Pieces | 3.39–3.73 g each, about half of it the steel washer; centre of gravity 3.6–5.6 mm above the board with no felt (1 mm higher with the optional felt) | Low and stable |
| 6 | Tipping | The worst piece (king) tips at about 13600 mm/s² with no felt (11300 with the optional felt), with no help from the magnet | 34× (28× with felt) above `$120` = 400, not a risk |
| 5, 7 | Grip | A centred pull of about 0.161 N is needed. At the funded build's 3.4 mm gap (no felt) the two estimates are 0.0118 N and 0.200 N, and other points of the same curve give up to 0.268 N. With the optional felt (4.4 mm): 0.0054 N and 0.143 N, up to 0.203 N. None of these is a bound | **Not settled on paper: the biggest risk. Milestone 1 decides it** |
| 7 | Pieces the magnet passes | Drags pass standing pieces 19.9–20 mm away with the magnet on. At μ = 0.3 the sideways pull there must stay below 0.0100 N (what holds a pawn), while the dragged piece needs about 0.040 N | **Not checked on paper. Milestone 1 measures it**, and every fix for weak grip must be re-checked against it |
| 8 | Rod sag | 0.66 mm at the middle of the board, worst case | The magnet's spring takes it up |
| 9 | Belts | 2200 mm of the 5000 mm roll | Plenty |
| 10 | Reset job | 110.8 s (1.8 min); magnet on for 71% of it | The drag feed is the setting that matters |
| 11 | Power | Estimated 0.87 A from the funded build's 3 A adapter (an energy balance). The worst-case bound, 3.22 A, is 0.22 A over 3 A, but reaching it would take 35.6 W in the motors and drivers against 7.4 W estimated | Enough: 3.4× margin on the estimate. Milestones 2 and 3 measure the real draw; the 5 A adapter is an optional add-back |
| 11 | Magnet heat | +19 K after one reset or in a game; +113 K if resets run back to back for half an hour | Fine for play; watch it in long test runs |
| 12 | Homing | Stock GRBL 1.1 homes Z first and stops with an alarm on a board with no Z switch | **Flash GRBL with a two-axis homing cycle** (section 12); homing then takes up to 18.7 s |

## 1. Steps per mm

| Input | Value | Basis |
|---|---|---|
| Belt pitch | 2 mm | design (GT2) |
| Pulley | 20 teeth | design |
| Motor | 200 full steps per turn (1.8°) | source: both motor listings (X: 17HS4401, Y: 17HS15-1504S-X1) |
| Microstepping | 1/16 | design (A4988, all three jumpers fitted) |

The funded build has two different motors. Y moves the whole gantry,
including the X motor, so it gets the stronger one, a STEPPERONLINE
17HS15-1504S-X1 (45 N·cm, 1.5 A). X moves only the magnet carriage and gets a
generic 17HS4401 (40 N·cm, 1.5 A). A second 17HS15-1504S-X1 for X is an
optional add-back. Below, figures tagged "17HS4401 listing" are for the X
motor and come from one seller's listing, not the one the BOM buys from, so
check the listing of the one you buy. Figures tagged "17HS15-1504S-X1
listing" are for the Y motor, from StepperOnline's product page and its
Amazon listing, which agree.

One pulley turn moves the belt 20 teeth × 2 mm = 40 mm.

steps/mm = full steps per turn × microsteps ÷ (teeth × pitch) = 200 × 16 ÷ 40

| Microstepping | Steps/mm | mm per step |
|---|---|---|
| 1/16 | 80 | 0.0125 |
| 1/8 | 40 | 0.0250 |
| full step | 5 | 0.2000 |

**Conclusion:** `$100` = `$101` = 80 with the 1/16 jumpers fitted, or 40 at 1/8.
Step size does not limit accuracy: even a full step (0.2 mm) is five times
finer than the ±1 mm target in Milestone 2. Belt stretch, frame squareness
and calibration will.

## 2. Speed: step rate and `$110` / `$111`

| Input | Value | Basis |
|---|---|---|
| GRBL step-rate ceiling on an Uno | 30000 steps/s per axis | source: GRBL 1.1 README |
| Supply | 12 V | design |
| Motor inductance, X | 2.8 mH per phase | source (17HS4401 listing) |
| Motor inductance, Y | 4.4 mH ±20% per phase (measured at 1 kHz) | source (17HS15-1504S-X1 listing) |
| Motor current | 1.05 A (70% of 1.5 A) | design (DESIGN.md sets Vref to about 70%) |

GRBL keeps a 30000 steps/s limit in its config file but leaves it switched off,
so it will accept faster settings; it just can't produce clean steps beyond that.

max feed = 30000 ÷ steps/mm × 60 = **22500 mm/min at 1/16** (45000 mm/min at 1/8).

So the step rate is not what limits speed. At the chosen `$110` = `$111` = 6000 mm/min:

- 100.0 mm/s = 8000 steps/s, 27% of the ceiling
- 2.50 motor turns per second (150 rpm), 500 full steps/s
- a diagonal rapid (`G0`) runs at 8485 mm/min, because GRBL limits each axis separately

A rule of thumb for the speed where a stepper's torque falls off: the coil
current can still reach full value in one full step up to about V ÷ (2 L I)
full steps per second. At 12 V and 1.05 A:

| Axis | Motor | L | V ÷ (2 L I) | As a feed | 6000 mm/min is |
|---|---|---|---|---|---|
| X | 17HS4401 | 2.8 mH | 2041 full steps/s | 24490 mm/min | 24.5% of it |
| Y | 17HS15-1504S-X1 | 4.4 mH | 1299 full steps/s | 15584 mm/min | 38.5% of it |
| Y, at the listing's +20% | 17HS15-1504S-X1 | 5.28 mH | 1082 full steps/s | 12987 mm/min | 46.2% of it |

The Y motor has more holding torque than X's (45 N·cm against 40) but more
inductance, so its torque starts to fall at a lower speed. The one published
pull-out curve found is for this motor: StepperOnline's, measured at 24 V and
1.5 A with 2000 microsteps per turn and a driver it doesn't name. It reads
42–43 N·cm from 30 to 210 rpm, then 40 N·cm at 300 rpm, 25 at 600 and 10 at
1200. The rule of thumb at the curve's own settings,
24 ÷ (2 × 4.4 mH × 1.5 A), gives 545 rpm, where the curve reads 28 N·cm, 65%
of its peak. The peak holds up to 210 rpm, 38.5% of that speed, and 93% of
it is left at 300 rpm, 55%. So on this motor the rule of thumb marks the
speed where about a third of the torque is already gone, not where the fall
begins.

`$111` = 6000 runs the Y motor at 38.5% of its own rule-of-thumb speed, the
same fraction as the end of the flat part of the curve: it should still have
about its low-speed torque, with little room to go faster before the torque
falls. X, at 24.5%, has more room. This comparison is rough. It assumes the
curve's shape scales with V ÷ (L I), which is the rule of thumb's own
assumption. It takes the curve's 1.5 A as the peak current; the curve
doesn't say, and read as an rms value the flat part would reach a higher
fraction, so on that question this is the cautious reading. No curve was
found for the 17HS4401.

The rule of thumb also leaves out back-EMF, the voltage the turning motor
generates in its own coils. Back-EMF is set by speed, not current, so it
takes twice the share of 12 V that it takes of 24 V, and on that count
scaling the 24 V curve down to 12 V is optimistic. A rough check that
includes it treats each phase as a sine-driven motor. Its torque constant
k_t is one phase's torque per amp on section 3's convention, holding torque
÷ (√2 × 1.5 A): 0.19 N·m/A on X and 0.21 on Y, an estimate. Its back-EMF at a rotor
speed ω (rad/s) is k_t ω (in SI units the torque constant and the back-EMF
constant are the same number), so a coil needs √((R I + k_t ω)² + (50 ω L I)²)
volts, where 50
is the number of electrical cycles per turn (200 full steps ÷ 4): the
back-EMF is in phase with the current and the inductive drop is 90° ahead of
it. The A4988's two transistors and sense resistor take 1.05 A × (2 × 0.43 +
0.1 Ω) = 1.01 V, which leaves 11.0 V:

| Axis | Needs at 150 rpm (6000 mm/min) | Current controllable up to | Multiple of 150 rpm |
|---|---|---|---|
| X, 17HS4401 | 5.1 V | about 388 rpm | 2.6× |
| Y, 17HS15-1504S-X1 | 6.8 V | about 281 rpm | 1.9× |
| Y, at the listing's +20% inductance | 7.2 V | about 256 rpm | 1.7× |

The same check at the curve's own 24 V and 1.5 A gives about 535 rpm (with
no driver drops, since the curve doesn't name its driver; that raises the
figure and makes what follows a little cautious). The curve's peak holds to
39% of that. `$111` = 6000 is 53% of Y's 281 rpm, and if the curve's shape
scales with this limit instead of V ÷ (L I), the curve at 53% of 535 rpm
(286 rpm) reads 40.5 N·cm, 94% of its peak. So counting back-EMF, Y at 6000
is a little past the end of the flat part rather than at it: still fine, with
less room to go faster than the rule of thumb suggests.

The default drag feed in `src/gcode.js`, `F2000`, is 33.3 mm/s or 2667 steps/s.

**Conclusion:** keep `$110` = `$111` = 6000. Section 10 shows that 10000
would only save 5 s on a whole reset, because most travel moves are short
and spend their time speeding up and slowing down. Y is the axis to test
first if `$111` is ever raised: it is already at or a little past the end of
the flat part of its torque curve, and the back-EMF check puts the speed
where its current can no longer keep up at about 1.9 times 6000.

## 3. Moving masses and motor torque

| Input | Value | Basis |
|---|---|---|
| 8 × 500 mm steel rod | 197.3 g | calculated: 7.85 g/cm³ (assumption) × π/4 × 8² × 500 mm |
| LM8UU bearing | 15 g | assumption (listings say 15–16 g) |
| Bearings on the carriage | 4 | assumption (two per X rod) |
| Printed carriage | 40 g | assumption |
| Electromagnet | 25 g | assumption (Adafruit's 5 V P20/15 is listed at 22.7 g) |
| Spring, screws, belt clamps on the carriage | 15 g | assumption |
| X motor (17HS4401) | 350 g | assumption (40 mm NEMA 17 bodies are often listed near 280 g; this allows a heavier one) |
| Printed end blocks and mounts | 80 g | assumption |
| Pulley, idler, screws on the gantry | 20 g | assumption |
| Resistance per axis | 5 N | assumption: binding from imperfect rod alignment, belt bending, the magnet's PTFE face sliding on the top |
| Holding torque | X: 40 N·cm; Y: 45 N·cm | source (17HS4401 listing; 17HS15-1504S-X1 listing) |
| Current factor | 1.05 A ÷ (√2 × 1.5 A) = 0.49 | assumption: the holding torque is rated with both phases at 1.5 A (the usual convention; neither listing says) |
| Speed derating | 0.5 | assumption: half of that torque is left at speed with microstepping |
| Rotor inertia | 54 g·cm² | source on X (17HS4401 listing). Not found for Y, so assumed the same (see below the table) |

- **Carriage** (moves in X): 4 × 15 g bearings + 40 g printed + 25 g magnet + 15 g hardware = **140 g**
- **Gantry** (moves in Y): 2 rods 395 g + 4 bearings 60 g + X motor 350 g + printed 80 g + hardware 20 g + carriage 140 g = **1045 g**
- **Piece**: at most 4.82 g (section 4). The magnet drags it, not the belts; its share of the load is negligible.

Belt force F = m a + resistance. Motor torque T = F r + J a ÷ r, where r is
the pulley's pitch radius, 20 × 2 mm ÷ 2π = 6.37 mm, and J the rotor inertia.

**Usable torque.** The A4988's current limit (1.05 A) is the peak of the sine
wave it drives through each coil when microstepping. At every microstep the
torque is then about what one phase gives at 1.05 A. If the X motor's
40 N·cm holding torque is rated with both phases at the full 1.5 A, one phase
at 1.5 A gives 40 ÷ √2 N·cm, so at 1.05 A the motor gives
40 × 1.05 ÷ (√2 × 1.5) = 40 × 0.49. Half of that is left at speed: usable
torque = 40 × 0.49 × 0.5 = 9.9 N·cm on X, and 45 × 0.49 × 0.5 = 11.1 N·cm on Y.

The Y motor's published curve (section 2) reads 43 N·cm at low speed at
1.5 A, where this model gives 45 ÷ √2 = 32 N·cm at 1.5 A before the speed
derating. So the model looks cautious if the curve's 1.5 A is the peak
current. Read as rms (2.12 A peak), the model gives 45 N·cm there, close to
the curve's 43, and the two agree with no hidden margin. The curve doesn't
name its driver or say which it means, so it is not used in place of the
model.

| Axis | Acceleration mm/s² | m a (N) | Resistance (N) | Belt force (N) | Torque (N·cm) | Usable (N·cm) | Margin |
|---|---|---|---|---|---|---|---|
| X | 400 | 0.06 | 5.0 | 5.06 | 3.25 | 9.9 | 3.0× |
| Y | 400 | 0.42 | 5.0 | 5.42 | 3.48 | 11.1 | 3.2× |
| X | 1000 | 0.14 | 5.0 | 5.14 | 3.36 | 9.9 | 2.9× |
| Y | 1000 | 1.04 | 5.0 | 6.04 | 3.93 | 11.1 | 2.8× |

The rotor's own inertia adds only 0.034 N·cm at 400 mm/s². The Y motor's
rotor inertia was not found: neither its product page nor its Amazon listing
gives it, and StepperOnline's full datasheet, a download from the product
page, was not opened. The table uses the 17HS4401's 54 g·cm² for it. Even at
twice that, Y would need 3.52 N·cm instead of 3.48.

**Conclusion:** the motors have about three times the torque needed: 3.2× on
Y and 3.0× on X at 400 mm/s². Y carries the heavier load, and its stronger
motor gives it the larger margin. The assumed 5 N of friction and binding is
most of the load, and the moving mass hardly matters. If an axis stalls or
skips, look for binding (rods out of parallel, a tight bearing) before
blaming the motor.

## 4. Piece mass and centre of gravity

**Method.** Each piece in [cad/pieces.scad](../cad/pieces.scad) was exported
as an STL (`$fn` = 64, OpenSCAD 2021.01). The script reads the triangles and
sums signed tetrahedra to get each piece's volume and the centre of that
volume, and sums the triangle areas to get the surface area and its centre.
The measured values are recorded in the script; `--stl-dir` or
`--export-stl` measures them again.

| Input | Value | Basis |
|---|---|---|
| PLA density | 1.24 g/cm³ | assumption (typical figure) |
| Infill | 20% | assumption (pieces.scad suggests 15–20%) |
| Solid walls | 0.8 mm | assumption: 2 perimeters of 0.4 mm, 4 top and bottom layers of 0.2 mm |
| M8 washer | 16 mm × 8.4 mm × 1.6 mm, steel 7.85 g/cm³ | design; density assumption |
| Washer position | glued against the top of the 1.8 mm pocket, so its face is 0.2 mm up inside it | assumption: glue between the washer and the top of the pocket makes the 0.2 mm smaller |
| Felt pad (optional add-back; the funded build has none) | 1.0 mm thick | assumption |

- **Printed mass** = 1.24 g/cm³ × (walls + 20% of the inside), where walls = surface area × 0.8 mm (at most the whole volume). A solid print (100%) is the upper bound.
- **Washer**: π/4 × (16² − 8.4²) × 1.6 = 233.0 mm³ of steel = **1.83 g**, its face 0.2 mm up inside the pocket and its centre 1.0 mm above the bottom of the base.
- **Centre of gravity** (CG) = (m_body × z_body + m_washer × z_washer) ÷ (m_body + m_washer), measured from the bottom of the base. In the funded build the base stands on the board, so that is the height above the board; the optional felt adds 1.0 mm to every height. The body's CG combines the walls (at the centre of the surface area) and the infill (at the centre of the volume).

| Piece | Height (mm) | Volume (cm³) | Area (cm²) | Printed (g) | Solid (g) | With washer (g) | CG (mm) | CG if solid (mm) | CG off-axis (mm) |
|---|---|---|---|---|---|---|---|---|---|
| pawn | 21.5 | 1.82 | 14.0 | 1.56 | 2.25 | 3.39 | 3.6 | 4.7 | 0.00 |
| rook | 22.0 | 2.41 | 16.4 | 1.90 | 2.99 | 3.73 | 4.9 | 6.2 | 0.00 |
| knight | 26.0 | 2.10 | 15.2 | 1.73 | 2.60 | 3.56 | 4.6 | 5.9 | 0.15 |
| bishop | 27.0 | 1.88 | 15.3 | 1.68 | 2.33 | 3.51 | 4.4 | 5.0 | 0.01 |
| queen | 28.0 | 2.30 | 16.5 | 1.88 | 2.85 | 3.71 | 5.4 | 6.6 | 0.00 |
| king | 31.5 | 2.34 | 16.6 | 1.90 | 2.90 | 3.73 | 5.6 | 6.8 | 0.00 |

"With washer" uses the 20% print; "CG off-axis" uses the solid print. The CG
columns are for the funded build; add 1.0 mm with the optional felt.

**Conclusion:** every piece weighs 3.39–3.73 g, and the 1.83 g washer is about
half of it, so the CG sits low: 5.6 mm above the board for the 31.5 mm king
(6.8 mm if printed solid; 6.6 and 7.8 mm with the optional felt), a quarter
of its height or less. The knight's head moves its CG only 0.15 mm off the
axis. The 34-piece set (32 plus two spare queens) needs about 58 g of PLA at
20% infill, before skirts and purges: the "about 60 g" the BOM allows for
the pieces, out of about 320 g of PLA on hand. The felt pad's own mass is
ignored.

## 5. Magnet pull through the board (estimate)

Every grip and tipping figure depends on how hard the magnet pulls the washer
through the board top. No force-versus-gap curve was found for the P20/15,
so this is the weakest estimate in the document.

**The gap** between the magnet face and the washer:

| Layer | Funded build (mm) | With the optional felt (mm) | Basis |
|---|---|---|---|
| PTFE tape on the magnet | 0.1 | 0.1 | assumption |
| Board top | 3.0 | 3.0 | design |
| Printed paper sheet and glue | 0.1 | 0.1 | assumption |
| Felt pad | none | 1.0 | design (the funded build has no felt); thickness an assumption |
| Washer recess in the pocket | 0.2 | 0.2 | assumption: the washer glued against the top of the 1.8 mm pocket (1.6 mm washer); glue there makes it smaller |
| **Total** | **3.4** | **4.4** | |

**The reference curve.** The closest published curve found is for the Eclipse
Magnetics M52180/12VDC, a 12 V holding magnet of similar size and power to
the P20/15, rated for 100% duty:

| | Eclipse M52180/12VDC | P20/15 (the BOM magnet) |
|---|---|---|
| Size | 20 mm across, 18 mm long | 20 mm across, 15 mm long |
| Mass | 36 g | 22.7 g (Adafruit's 5 V version) |
| Power | 2.5 W (12 V, 210 mA) | 3 W (12 V, 0.25 A) |
| Rated pull in contact | 53 N | 2.5–3 kg (24.5–29 N) in listings, about half the Eclipse's |

Its datasheet gives 53 N in contact, 22 N at 0.09 mm, 9 N at 0.18 mm, 5 N at
0.27 mm, 3 N at 0.36 mm, 2 N at 0.59 mm and 1 N at 1.00 mm (±10%), measured
on its M52171/25ARM armature plate, 25 mm across and 3 mm thick. The table
gives whole newtons only, so the last two points, 2 N and 1 N, fix the slope
only roughly. The pull has already dropped to 2% of its contact rating at
1 mm, and the table stops there.

Two ways to carry it on to 3.4 and 4.4 mm:

- **High estimate**: continue the slope between the last two points: F = 1 N × (1 mm ÷ gap)^1.31.
- **Low estimate**: scale down to the P20/15's lower rating (24.5 N, from listings that say 2.5 kg; some say 3 kg) and assume the pull falls with the cube of the gap beyond 1 mm: F = 1 N × 24.5/53 × (1 mm ÷ gap)³. (Assumption: once the gap is larger than the spacing between the magnet's poles, more of the flux goes straight from pole to pole without crossing the steel, so the pull falls faster than near contact.)

| Gap | High estimate (N) | Low estimate (N) | Heaviest piece's weight (N) |
|---|---|---|---|
| 3.4 mm (funded build, no felt) | 0.200 | 0.0118 | 0.047 |
| 4.4 mm (with the optional felt) | 0.143 | 0.0054 | 0.047 |
| 2.4 mm (no felt, 2 mm top) | 0.317 | 0.0334 | 0.047 |

The high estimate depends on which table points set the slope. The same
power law through the 1.00 mm point, starting from each earlier point:

| From | Exponent | Pull at 3.4 mm (N) | Pull at 4.4 mm (N) |
|---|---|---|---|
| 0.09 mm (22 N) | 1.28 | 0.208 | 0.149 |
| 0.18 mm (9 N) | 1.28 | 0.208 | 0.150 |
| 0.27 mm (5 N) | 1.23 | 0.222 | 0.162 |
| 0.36 mm (3 N) | 1.08 | 0.268 | 0.203 |
| 0.59 mm (2 N), the high estimate | 1.31 | 0.200 | 0.143 |

Neither estimate allows for the washer being smaller than the test plate, or
for the 8.4 mm hole in its middle. Adafruit gives the P20/15 a "center
diameter" of 8 mm, which on a pot-shaped holding magnet like this is the
centre pole, so the hole sits right over it. Both make the real pull lower;
by how much was not worked out.

**Conclusion:** through the funded build's 3.4 mm the two extrapolations
give 0.0118 N and 0.200 N, 0.25 and 4.23 times the weight of the heaviest
piece, and other points of the same table give 0.200 to 0.268 N. With the
optional felt (4.4 mm) they give 0.0054 N and 0.143 N, 0.11 and 3.02 times
that weight, and 0.143 to 0.203 N from other points. None of these is a
bound: the washer's shape can make the real pull lower than all of them, and
the table's coarse whole-newton points leave the high end uncertain. Leaving
out the 1 mm felt pad, as the funded build does, multiplies the pull by 1.40
on the high estimate and 2.17 on the low one. A 2 mm top would multiply the
funded build's pull by another 1.58 (high) or 2.84 (low).

## 6. Tipping

When the magnet speeds a piece up or slows it down, the piece's inertia acts
at its CG (height h) while the magnet drives it low down, at the washer
(height z_w). The piece would tip about the edge it stands on (radius r): the
edge of its printed base in the funded build, or of the felt pad with the
optional felt. Taking moments about that edge at the moment the far side
lifts, for the braking case (the worse one, because friction then adds to the
tipping moment):

m a (h − z_w) = (m g + F_v) (r − μ z_w)

**a_tip = (g + F_v ÷ m) × (r − μ z_w) ÷ (h − z_w)**

where F_v is the magnet's downward pull and μ the friction coefficient of
the base (or the felt) on the sheet. Speeding up gives r + μ z_w instead,
which is more stable. Ignoring the magnet's pull and putting the drive at the
board surface gives the simple bound **a_tip = g r ÷ h**, which is lower than
the full formula whenever r > μ h. That holds for every piece here, in both
cases, so the simple bound is the safe figure.

| Input | Funded build (no felt) | With the optional felt | Basis |
|---|---|---|---|
| r, less the CG's off-axis offset | 9.5 mm, the edge of the 19 mm base | 9.0 mm, an 18 mm felt pad cut a little inside the base | design ([cad/pieces.scad](../cad/pieces.scad)); the felt's size is an assumption |
| z_w | 1.0 mm | 2.0 mm | washer centre (section 4), plus the felt |
| μ | 0.3 | 0.3 | assumption (section 7) |
| F_v, 0.5 × the centred pull at that gap | 0.0059 N (low estimate) or 0.100 N (high) | 0.0027 N (low) or 0.071 N (high) | assumption (section 7) |
| h, m | solid prints from section 4 | the same, h 1 mm higher | the heavier, higher-CG case |

- A: g r ÷ h, no magnet pull, drive at the board surface
- B: g (r − μ z_w) ÷ (h − z_w), drive at the washer while braking, no magnet pull
- C: the full formula with the magnet's pull, low and high estimates

Funded build, no felt:

| Piece | CG (mm) | Mass (g) | A (mm/s²) | B (mm/s²) | C low (mm/s²) | C high (mm/s²) | A ÷ `$120` |
|---|---|---|---|---|---|---|---|
| pawn | 4.7 | 4.08 | 19900 | 24500 | 28100 | 85700 | 50× |
| rook | 6.2 | 4.82 | 15100 | 17500 | 19700 | 54500 | 38× |
| knight | 5.9 | 4.43 | 15600 | 18200 | 20700 | 60200 | 39× |
| bishop | 5.0 | 4.16 | 18500 | 22400 | 25600 | 77500 | 46× |
| queen | 6.6 | 4.68 | 14100 | 16100 | 18100 | 51200 | 35× |
| king | 6.8 | 4.73 | 13600 | 15500 | 17400 | 48900 | 34× |

With the optional felt:

| Piece | CG (mm) | Mass (g) | A (mm/s²) | B (mm/s²) | C low (mm/s²) | C high (mm/s²) | A ÷ `$120` |
|---|---|---|---|---|---|---|---|
| pawn | 5.7 | 4.08 | 15500 | 22400 | 23900 | 62200 | 39× |
| rook | 7.2 | 4.82 | 12300 | 16000 | 16900 | 40100 | 31× |
| knight | 6.9 | 4.43 | 12600 | 16600 | 17600 | 43900 | 32× |
| bishop | 6.0 | 4.16 | 14600 | 20500 | 21800 | 56300 | 37× |
| queen | 7.6 | 4.68 | 11600 | 14700 | 15600 | 37500 | 29× |
| king | 7.8 | 4.73 | 11300 | 14100 | 15000 | 35900 | 28× |

(Rounded to the nearest 100 mm/s².)

**With no felt the washer is exposed.** The washer pocket is open at the
bottom of the base, 16.4 mm across in the 19 mm base
([cad/pieces.scad](../cad/pieces.scad)), so a piece with no felt stands on a
1.3 mm ring of PLA, with the washer's face 0.2 mm above the board (section
4). If the washer sits flush with that ring or stands proud of it, as glue
between the washer and the top of its pocket or a washer as thick as the
1.8 mm pocket would make it, the piece stands on the steel instead. Its
friction on the sheet changes (no figure for steel on paper was looked for),
it tips about the washer's edge (r = 8.0 mm), and the washer may mark the
printed sheet. Tipping is still no risk: A for the king becomes 11500 mm/s²,
29× `$120`. Milestone 1 checks where the washers sit
([What Milestone 1 should measure](#what-milestone-1-should-measure)).

**Conclusion:** even with no help from the magnet, the king only tips above
about 13600 mm/s² in the funded build, 34 times the 400 mm/s² that `$120` /
`$121` allow. With the optional felt it is 11300 mm/s², 28 times: the pad is
narrower than the base and lifts the CG by 1 mm. Either way the washer keeps
the CG low enough that GRBL's acceleration cannot tip a piece. If a king
wobbles in testing, look elsewhere first: the base (or the felt) catching on
a seam or the edge of the sheet, a piece being dragged into another one, or a
piece that falls behind the magnet and is yanked when it catches up.

## 7. Grip: does the piece follow the magnet?

While the magnet drags a piece, the piece trails behind it until the sideways
pull matches the resistance. The base (or the felt, if added) resists with μ
times the total downward force, which is the piece's weight **plus the
magnet's own downward pull**, so a stronger magnet adds friction as well as
grip:

- needed sideways force = μ (m g + F_v) + m a
- available sideways force = s F_v

where s is the ratio of sideways to downward pull at the trailing offset
where the sideways pull is largest. The piece keeps up if

**F_v (s − μ) ≥ μ m g + m a**

If s is no bigger than μ, no magnet is strong enough.

| Input | Value | Basis |
|---|---|---|
| Piece | rook, solid print: 4.82 g, weight 0.0473 N | section 4 (the heaviest) |
| m a | 0.0019 N at 400 mm/s² | |
| μ, the piece on the paper sheet | 0.3 (0.2–0.4 tried) | assumption: no published figure found for bare printed PLA on paper (the funded build) or for felt on paper (the optional add-back), so the same value and range stand for both |
| s | 0.5 (0.4–0.7 tried) | assumption: no source found |
| F_v at that offset | 0.5 × the centred pull | assumption |

The m a term is small next to friction (μ m g = 0.0142 N), so a lower
acceleration barely helps grip.

**The funded build has no felt.** That is lever 2 at the end of this
section, already taken, and it changes three things:

- **The gap** is 3.4 mm instead of 4.4, so the magnet pulls 1.40 (high estimate) to 2.17 (low) times as hard, on the dragged piece and on the pieces it passes alike (section 5).
- **The friction coefficient** is that of the printed base on the sheet, not felt. Neither was found, so both keep μ = 0.3 with 0.2–0.4 tried. Milestone 1 measures bare PLA first, then felt.
- **Standing pieces** feel the stronger pull too. What holds one in place is μ m g with the base's μ (plus friction from the magnet's downward pull on it, which only helps and is ignored below), while the sideways pull on it grows with the magnet's strength. "Pieces the magnet passes" below works out what that asks of the magnet.

The next two tables don't depend on the felt; the comparison after them
covers both gaps.

Centred pull needed (N), for each μ and s:

| μ | s = 0.4 | s = 0.5 | s = 0.7 |
|---|---|---|---|
| 0.2 | 0.114 | 0.076 | 0.046 |
| 0.3 | 0.322 | 0.161 | 0.081 |
| 0.4 | never | 0.417 | 0.139 |

The largest gap that still gives that pull, for s = 0.5, on the two curves
from section 5:

| μ | Pull needed (N) | High-estimate gap (mm) | Low-estimate gap (mm) |
|---|---|---|---|
| 0.2 | 0.076 | 7.1 | 1.8 |
| 0.3 | 0.161 | 4.0 | 1.4 |
| 0.4 | 0.417 | 1.9 | 1.0 |

With μ = 0.3 and s = 0.5, the 0.161 N needed compares with:

| Gap | Pull | ÷ pull needed | Sideways force needed (N) | Available (N) | Ratio |
|---|---|---|---|---|---|
| 3.4 mm, funded build | High estimate, 0.200 N | 1.24 | 0.0462 | 0.0501 | 1.08 |
| 3.4 mm, funded build | Top of the range from other table points, 0.268 N | 1.66 | 0.0564 | 0.0671 | 1.19 |
| 3.4 mm, funded build | Low estimate, 0.0118 N | 0.07 | 0.0179 | 0.0029 | 0.16 |
| 4.4 mm, with felt | High estimate, 0.143 N | 0.89 | 0.0375 | 0.0357 | 0.95 |
| 4.4 mm, with felt | Top of the range from other table points, 0.203 N | 1.26 | 0.0466 | 0.0508 | 1.09 |
| 4.4 mm, with felt | Low estimate, 0.0054 N | 0.03 | 0.0169 | 0.0014 | 0.08 |

Adding the felt back costs 1 mm of gap, so it only helps grip if the felt
slides enough more easily than bare PLA to make up for the weaker pull. With
bare PLA at μ = 0.3, felt breaks even at μ = 0.26 on the high estimate's
slope and 0.20 on the low one's; a felt with a higher μ than that makes grip
worse.

**Pieces the magnet passes.** A switched-on magnet pulls on every washer near
it, not only the one it is dragging. [src/motion.js](../src/motion.js) keeps
at least one piece diameter, 19 mm (0.475 × 40 mm), between a dragged
piece's centre and every other piece's centre. In the 22-move reset job,
drags pass a standing piece within 20 mm 22 times; the closest is 19.9 mm.
A washer 20 mm off the magnet's axis has its near edge 12 mm from the axis,
just outside the magnet's 10 mm radius. A standing piece slides towards the
magnet once the sideways pull on it is more than μ (m g + F_v there). The
lightest piece is a pawn at 20% infill (3.39 g). The table compares the
sideways pull the dragged piece needs (s × F_v at the centred pull needed,
s = 0.5) with what holds a standing pawn, ignoring the magnet's downward
pull on the pawn, which only helps it stay put:

| μ | Centred pull needed (N) | Peak sideways pull needed on the dragged piece (N) | What holds a standing pawn, μ m g (N) | Ratio of the two |
|---|---|---|---|---|
| 0.2 | 0.076 | 0.0190 | 0.0067 | 2.9× |
| 0.3 | 0.161 | 0.0403 | 0.0100 | 4.0× |
| 0.4 | 0.417 | 0.1043 | 0.0133 | 7.8× |

So the design needs a pull that is strong right over the piece and weak
20 mm out. At μ = 0.3, with a magnet just strong enough to drag the rook,
the sideways pull 20 mm from the axis must be under a quarter of its peak
over the dragged piece. A stronger magnet needs the pull to fall off even
faster, because what holds a standing pawn stays the same. That is the
funded build's case if the high end of section 5 holds: at the 3.4 mm gap,
the peak sideways pull (s × 0.5 × the centred pull) is 5.0 times what holds
a standing pawn at the high estimate (0.200 N) and 6.7 times at the top of
the range (0.268 N), so the pull 20 mm out must fall below a fifth, or a
6.7th, of its peak. With the felt the same figures are 3.6 and 5.1 times.
Leaving the felt out strengthens the pull on the pieces the magnet passes
along with the one it drags. No force-versus-offset data were found to check
this. Milestone 1 measures it (step 4).

**Conclusion:** on paper the grip is unsettled. In the funded build (3.4 mm,
no felt) the high estimate of the pull is a little more than what is needed:
1.24 times it from the last two table points, up to 1.66 times from other
points of the same table, which gives 1.08 to 1.19 times the sideways force
needed. The low estimate gives less than a fifth of that force. With the
optional felt (4.4 mm) the high estimate is about equal to what is needed
(0.89 to 1.26 times) and the low one gives less than a tenth. This is the
"riskiest question" the roadmap puts first, and these numbers cannot settle
it: the answer swings across the whole range with μ, s and the real pull,
none of which could be checked. Milestone 1 measures them. If they land at
the weak end, these are the levers (the first two are sized in the tables
above; the last two were not quantified):

1. Less friction under the piece, which raises s − μ: going from μ = 0.3 to 0.2 halves the pull needed (0.161 N to 0.076 N). A smoother sheet, or a pad that slides better than bare PLA; felt (the optional add-back) helps only if its μ is low enough to pay for the 1 mm it adds to the gap (see above).
2. A smaller gap. The funded build already leaves out the 1 mm felt, which multiplies the pull by 1.40 to 2.17 over the felt version (section 5). A 2 mm top would multiply it by another 1.58 to 2.84.
3. A plain steel disc without a hole instead of the M8 washer.
4. A stronger magnet.

Each lever also changes how hard the magnet pulls on the pieces it passes,
so re-check every one against that limit. Levers 2, 3 and 4 strengthen the
pull 20 mm out as well as over the dragged piece. Lever 1 lowers what holds a
standing pawn (0.0100 N to 0.0067 N), but it lowers the grip needed more, so
the ratio needed falls from 4.0× to 2.9×.

Acceleration and drag speed hardly enter this model (friction is assumed not
to depend on speed), so slowing down is not a fix by itself.

One more effect to measure: when the magnet stops, the piece stops where the
sideways pull falls to the static friction, some distance short of the
magnet's centre. If that distance is more than about 1 mm, the G-code could
overshoot each drag slightly and come back. That would be a software change
and is not done here.

## 8. Rod deflection

| Input | Value | Basis |
|---|---|---|
| Rod | 8 mm, I = π d⁴ ÷ 64 = 201.1 mm⁴ | design |
| Steel modulus E | 200000 N/mm² | assumption |
| Span | 500 mm, simply supported | assumption: the whole rod length, which overstates the sag |
| Magnet spring preload | 2 N | assumption: the top end of a "light" spring |

The spring pushes the magnet up against the board top and pushes the
carriage down by the same amount, so the X rods carry the carriage's weight
plus the preload. The magnet's pull on a piece does not load the rods: the
magnet is already pressed against the top, and the top takes that force. The
Y rods carry the whole gantry plus the preload. Each pair of rods shares its
load equally, and the worst case puts all of it at mid-span.

- point load at mid-span: δ = P L³ ÷ (48 E I)
- the rod's own weight: δ = 5 w L⁴ ÷ (384 E I) = 0.078 mm

| Rods | Load per rod | Sag from the load | With own weight |
|---|---|---|---|
| X (carriage 1.37 N + spring 2 N, ÷ 2) | 1.69 N | 0.109 mm | 0.19 mm |
| Y (gantry 10.25 N + spring 2 N, ÷ 2) | 6.12 N | 0.397 mm | 0.47 mm |

**Conclusion:** at the middle of the board the carriage sits at most 0.66 mm
lower than at the corners. The spring keeps the magnet pressed on the top, so
this does not change the gap. Rod holders that clamp the ends rigidly would
cut the sag from the loads to a quarter (P L³ ÷ (192 E I): 0.027 mm on X,
0.099 mm on Y), though printed holders are not fully rigid. Give the spring at least 3 mm
of working travel; that figure is a judgment, not a calculation, to cover the
frame's flatness and any sag of the board top as well.

## 9. Belt lengths

Each axis has one belt loop: from the moving part, around the motor pulley,
back along the axis, around an idler, and back to the moving part, with both
ends clamped.

loop = 2 × centre distance + 20 teeth × 2 mm (half of each pulley) + 2 × clamp allowance

| Input | Value | Basis |
|---|---|---|
| Centre distance, pulley to idler | 500 mm | assumption: about one rod length (the CAD sets the real figure) |
| Clamp allowance | 30 mm per belt end | assumption |
| Roll | 5000 mm | design (BOM) |

One loop = 2 × 500 + 40 + 2 × 30 = **1100 mm**. X and Y together use 2200 mm,
leaving 2800 mm. If the gantry racks and needs a second Y belt, a third loop
still leaves 1700 mm. The idlers are 20-tooth either way, the belt kit's
5 mm-bore ones in the funded build or the optional 3 mm-bore ones, so the
loop is the same with both.

## 10. Reset job: time and magnet duty

**Method.** The script plans the reset job exactly as
`node demo.js reset --storage 1 --square 40 --size 0.475` does, writes its
G-code with `src/gcode.js`, and runs that G-code through a model of GRBL 1.1's
motion planner:

- `G0` at `$110`/`$111` and `G1` at the programmed feed, each axis limited separately, as GRBL does
- speeds ramp at `$120`/`$121`; corners slow down by GRBL's junction-deviation rule with `$11` = 0.010 mm, and straight runs of segments keep full speed
- `M8`, `M9` and `G4` wait for motion to stop (GRBL empties its buffer for them), so every drag starts and ends at rest
- the magnet starts and ends at `X0 Y0`, the outer corner of the left storage column (offsets of 0)

Not modelled: homing (up to 18.7 s, section 12), delays in streaming
G-code over USB (the sender is assumed to keep GRBL's buffer full), and
GRBL's stepwise speed updates.

The planner's figures: 22 moves, 2397 mm dragged, 2101 mm of empty travel
between moves. The G-code adds the trips out from and back to `X0 Y0`, so it
has 2352 mm of `G0` travel and 2397 mm of `G1` drags.

With `$110` = 6000, `$120` = 400 and `F2000`:

- travel 27.8 s + drags 74.2 s + pauses 8.8 s = **110.8 s (1.8 min)**
- magnet on for 78.6 s, **71%** of the job, 3.57 s per move
- drags average 32.3 mm/s against the 33.3 mm/s set by `F2000`; corners slow them down

| Settings | Travel (s) | Drags (s) | Pauses (s) | Total (s) | Magnet on |
|---|---|---|---|---|---|
| recommended | 27.8 | 74.2 | 8.8 | 110.8 | 71% |
| drag `F1000` | 27.8 | 144.8 | 8.8 | 181.3 | 82% |
| drag `F3000` | 27.8 | 51.7 | 8.8 | 88.3 | 64% |
| `$120` = 800 | 24.9 | 73.0 | 8.8 | 106.6 | 73% |
| `$110` = 10000 | 22.6 | 74.2 | 8.8 | 105.6 | 74% |

**Conclusion:** a reset takes just under two minutes, plus homing. Dragging
is 74.2 s of the 110.8 s, so the drag feed is the only setting that changes
the total much: `F3000` would take 88.3 s, and `F1000`, where Milestone 3 starts
tuning, 181.3 s. Doubling the acceleration saves 4 s and `$110` = 10000
saves 5 s, which is not worth the extra noise. Use the fastest drag feed that
passes the Milestone 3 test.

## 11. Power budget and magnet heat

**Power**

The funded build has a 12 V 3 A adapter. A 12 V 5 A adapter is an optional
add-back. The 5 A fuse stays on the +12 V line with either adapter.

**Worst-case bound.** Each motor can draw no more than its coil currents:

| Load | Current from 12 V | Basis |
|---|---|---|
| X motor | at most 1.48 A | design: the current limit is 1.05 A (70% of 1.5 A) per coil. While a coil is driven, its bridge draws exactly the coil current from the supply; in slow decay it draws nothing, and in fast decay it returns current, so a coil never draws more than its own current. The two coils' currents add up to at most √2 × 1.05 A, when both are at 71% of the limit, as they are at each full-step position. |
| Y motor | at most 1.48 A | same |
| Electromagnet | 0.25 A (3.0 W, 48 Ω coil) | design |
| Arduino | none | it runs from USB |
| **Total** | **at most 3.22 A (39 W)** | for the coils and the magnet: 0.22 A over the funded build's 3 A adapter, and under the optional 5 A adapter and the 5 A fuse |

The two A4988s also draw their own supply current, at most 4 mA each (IBB in
Allegro's datasheet), 0.008 A together; the estimate below includes it.

The bound takes the current limit as exactly 1.05 A. A limit set higher, by
a Vref set high or by the A4988's own trip-level error, raises the motors'
share in proportion.

This bound would be reached only if every coil were connected to the 12 V
supply all the time, and the motors are far from that. Each coil needs only
about 1.05 A × its phase resistance at standstill (1.6 V on X, 2.4 V on Y),
more as the motor speeds up and its back-EMF rises (section 2), so the
chopper takes current from the supply for only part of the time. The bound
is also an instantaneous figure. The current drawn changes from moment to
moment as the chopper switches, and the capacitance on the 12 V rail smooths
those short pulses, so the adapter supplies their average.

**Estimate from an energy balance.** Averaged over many steps, the supply
provides the power the motors and drivers use. Within each electrical cycle
(four full steps) energy also flows into the coils' inductance and back out,
but over whole cycles that nets out. The decay mode doesn't change this:
slow decay recirculates the current inside the bridge, and fast decay
returns the coils' stored energy to the 12 V rail, so the balance already
nets them out; their cost is the conduction loss counted below. So the
supply current is about (copper loss + driver conduction loss + sense
resistor loss + mechanical output) ÷ 12 V, plus the drivers' own current and
the magnet. At every microstep the two coil currents are 1.05 A times the
cosine and the sine of the step angle, so each loss below is 1.05² × the
resistance the current flows through, at any position:

- **Copper loss**: 1.05² × the phase resistance: 1.5 Ω on X (17HS4401 listing), 2.3 Ω on Y (17HS15-1504S-X1 listing).
- **Driver conduction loss**: each coil's current always flows through two of the A4988's output transistors (a source and a sink while driving; a pair turned on by its synchronous rectification while the current decays), so 1.05² × 2 × Rds(on). Allegro's datasheet gives Rds(on) = 0.32 Ω typical and 0.43 Ω maximum for each transistor (at 1.5 A, 25 °C); the estimate uses the maximum.
- **Sense resistor**: at most 1.05² × 0.1 Ω (R100 boards; R068 boards lose less).
- **Mechanical output**: section 3's torque at 400 mm/s² times the pulley's speed at `$110` = 6000 mm/min, 100 mm/s ÷ 6.37 mm = 15.7 rad/s.

Both motors are counted as running at full speed with the magnet on, the
worst combination. (In the reset job the magnet is off during `G0` travel,
and drags run at a third of that speed.)

| Motor | Phase resistance | Copper (W) | Driver (W) | Sense resistor (W) | Output (W) | Total (W) | From 12 V (A) |
|---|---|---|---|---|---|---|---|
| X, 17HS4401 | 1.5 Ω | 1.65 | 0.95 | 0.11 | 0.51 | 3.22 | 0.27 |
| Y, 17HS15-1504S-X1 | 2.3 Ω | 2.54 | 0.95 | 0.11 | 0.55 | 4.14 | 0.35 |

Motors 0.61 A + the drivers' own 0.008 A + the magnet's 0.25 A = **0.87 A
(10.5 W)**, 29% of the 3 A adapter: a 3.4× margin.

This is an estimate, not a bound. It leaves out the A4988's switching losses
(including its body diodes, which conduct during the 475 ns dead time between
transistors), the motors' iron losses, which grow with speed, and the rise in
Rds(on) as the driver chip heats (the datasheet's maximum is at 25 °C); no
figures for these were found. It also takes the coil resistances from the
listings, at room temperature, and the current limit as exactly 1.05 A.
Copper loss is the largest term (1.65 W and 2.54 W in the table), and three
things can move it:

- The windings warm up in use, and copper's resistance rises 0.393% per kelvin.
- The X motor's listing disagrees with itself. It gives 1.5 Ω per coil, but also a rated voltage of 3.6 V, which at its 1.5 A would mean 2.4 Ω. The BOM buys the X motor from a different seller, too.
- Vref is set by hand with a multimeter, and the A4988's current trip level has its own error: Allegro gives ±5% at VREF = 2 V, and nothing at the 0.84 V (or 0.57 V) used here.

When the motors arrive, measure each coil's resistance with the multimeter
(touch the probes together first and subtract that reading). It takes a
minute and pins down the largest term.

Some what-ifs, each changing one input of the 0.87 A case (the column is the
total):

| What if | Supply current |
|---|---|
| Rds(on) at its typical 0.32 Ω instead of the maximum | 0.83 A |
| Windings 50 K above room temperature (copper resistance × 1.20) | 0.94 A |
| X coils at 2.4 Ω, from the X listing's 3.6 V rated voltage | 0.95 A |
| Each axis needed all its usable torque at full speed (about three times the assumed load, section 3) | 1.06 A |
| Each motor delivered its full torque at 1.05 A (19.8 N·cm on X, 22.3 on Y, with no 0.5 speed derating), the most it can give before it stalls on section 3's torque model | 1.33 A |
| The motors' share were twice the estimate, for the losses left out | 1.49 A |

Every one of these stays under half of the 3 A adapter. Reaching the 3.22 A
bound would take 35.6 W into the motors and drivers, 4.8 times the 7.4 W
estimated, so it is not a realistic operating point.

The A4988's current limit is I = Vref ÷ (8 × Rs), where Rs is the current
sense resistor on the driver board. For 1.05 A: Vref = 0.84 V if the
resistors are marked R100 (0.100 Ω), or 0.57 V if they are R068
(0.068 Ω). Read the marking on your own boards before setting Vref.

**Conclusion (power):** the 3 A adapter is enough. The estimate, 0.87 A, uses
29% of it, a 3.4× margin, and even doubling the motors' share for the losses
left out uses half of it. The 3.22 A worst-case bound is 0.22 A over 3 A, but
it needs nearly five times the power the estimate finds. The adapter is a
no-name part, and its 3 A is the listing's claim, so measure the real draw
(below). The optional 5 A adapter would cover even the bound. Keep the 5 A
fuse either way.

**Measure it in Milestones 2 and 3.** Put a multimeter, on its 10 A range,
in series with the +12 V lead between the adapter and the fuse, and note the
highest reading in each case. Milestone 2 runs the motors, with no magnet
yet:

- While homing (`$H`, both axes at `$25` = 1500 mm/min): about 0.56 A on this estimate.
- With the motors enabled and still: about 0.53 A. GRBL switches the drivers off 25 ms after motion stops (`$1` = 25, its default), so set `$1=255` for this reading and `$1=25` again after it. Standing still, the motors turn no power into motion, so this reading checks the copper, driver and sense-resistor losses, most of the estimate, on their own.
- During long `G0` moves inside the homed range: about 0.62 A. After homing, machine coordinates run from −`$130` to 0 on X and −`$131` to 0 on Y (section 12), so with `$130` = 380 and `$131` = 300, send `G53 G0 X-370 Y-290` and `G53 G0 X-10 Y-10` a few times each from the G-code sender. Stay inside your own `$130` and `$131`.

Milestone 3 mounts the magnet and wires it to `CoolEn`. Take the last
reading the first time the reset job runs there, written and sent as
[ROADMAP.md](../ROADMAP.md) gives it:
`node demo.js reset --storage 1 --size 0.475 --calibration calibration.json --gcode reset.gcode`,
then `node send.js reset.gcode --port <your port> --home`.

- During a drag at `F2000`, magnet on: about 0.81 A.

A meter averages over its update time, so short peaks while the motors speed
up won't all show. If a reading passes about 2 A, two thirds of the adapter's
rating (a judgment), stop: look for binding or a Vref set too high before
running longer, or fit the 5 A adapter. Also check that the voltage at the
shield's power terminal stays near 12 V while the job runs.

**Magnet heat.** A simple model: the magnet is one lump that loses heat from
its side and back (the face presses on the board top).

| Input | Value | Basis |
|---|---|---|
| Power while on | 3.0 W | design (12 V × 0.25 A) |
| Exposed area | π × 20 × 15 + π/4 × 20² = 1257 mm² | design (20 × 15 mm body) |
| Heat transfer h | 15 W/(m²·K) | assumption: still air, convection plus radiation |
| Heat capacity | 11.25 J/K | assumption: 25 g of steel and copper at about 0.45 J/(g·K) |
| Seconds between moves in a game | 30 | assumption |

Thermal resistance R = 1 ÷ (h A) = 53 K/W, and the time constant R × C is
597 s (10 min). The steady temperature rise is power × duty × R; one job from
cold rises by power × duty × R × (1 − e^(−t ÷ RC)).

| Case | Duty | Average power (W) | Temperature rise (K) |
|---|---|---|---|
| Left on continuously (steady) | 100% | 3.00 | 159 |
| One reset job from cold | 71% | 2.13 | 19 |
| Reset jobs back to back (steady) | 71% | 2.13 | 113 |
| A game, one move every 30 s (steady) | 12% | 0.36 | 19 |

A hot coil also grips less. Copper's resistance rises 0.393% per kelvin, so a
coil 50 K above room temperature has 1.20 times the resistance, 84% of the
current and about 70% of the pull (the pull goes roughly with the current
squared across a large gap).

**Conclusion:**

- A reset or a game warms the magnet by about 19 K. That is fine.
- Back-to-back jobs for more than about half an hour (three time constants), such as the overnight soak test in Milestone 6, would heat it by about 113 K on this model. That is far too hot for a PLA carriage, which softens at roughly 60 °C, and the hot coil would lose grip. Add pauses, or check the temperature during long runs.
- The model ignores heat conducted into the carriage and the board top, so it probably reads high. Eclipse rates its similar magnet for 100% duty, and a P20/15 seller says the coil runs warm when left on, but neither gives a temperature. Milestone 1 measures it.
- Hold the magnet by the threaded hole in its back and leave air around its body, rather than boxing it in printed plastic.

## 12. Recommended GRBL settings

**Flash GRBL with a two-axis homing cycle first.** Stock GRBL 1.1 cannot
home this machine. Its `config.h` homes Z on its own first
(`#define HOMING_CYCLE_0 (1<<Z_AXIS)`), then X and Y together
(`HOMING_CYCLE_1`). This board has no Z switch, so `$H` searches for one
over 1.5 × `$132` of travel and then stops with `ALARM:9` (homing failed: no
switch found). Milestone 2's homing and `send.js --home` both fail on a stock
flash. Before compiling and uploading GRBL, edit `grbl/config.h`:

```c
#define HOMING_CYCLE_0 ((1<<X_AXIS)|(1<<Y_AXIS))  // home X and Y together
// #define HOMING_CYCLE_1 ((1<<X_AXIS)|(1<<Y_AXIS))
```

`config.h` gives that first line as its own example for two-axis machines.

| Setting | Value | Why |
|---|---|---|
| `$5` | 0 | GRBL's default. The limit pins are pulled high and read as triggered when low, which suits normally-open switches wired between signal and GND. |
| `$100`, `$101` | 80 | Section 1 (1/16 microstepping; 40 at 1/8) |
| `$110`, `$111` | 6000 | Section 2: 27% of the step-rate ceiling. X runs at 24.5% of its rule-of-thumb roll-off speed; Y at 38.5%, at or a little past the end of the flat part of its published torque curve (counting back-EMF), so test Y first before raising `$111`. Faster saves little anyway (section 10) |
| `$120`, `$121` | 400 | Section 6: 34× below the tipping point in the funded build, 28× with the optional felt. Section 3: about 3× torque margin (3.0× X, 3.2× Y). Section 10: 800 would save only 4 s. Raise it only after Milestone 3 passes. |
| `$11` | 0.010 | GRBL's default junction deviation, used in section 10 |
| `$20` | 1 | Soft limits after homing |
| `$22` | 1 | Homing on |
| `$23` | 3 if the switches are at the X-min and Y-min ends | GRBL homes towards +X and +Y by default (`$23` = 0); 3 reverses both axes |
| `$25` | 1500 | Homing seek speed: 15.2 s to cross 380 mm instead of 46 s at the default 500. A judgment: lower it if the switches get hit hard. |
| `$130`, `$131` | 380, 300 or more | The G-code reaches cell centres from 20 to 380 mm in X and 20 to 300 mm in Y, plus the calibration offsets. Set them to the travel you measure. |

**Homing time.** GRBL homes in four phases (`limits.c`): a seek to the
switches at `$25`, a pull-off of `$27` (default 1 mm), a slow approach back
onto the switches at `$24` (default 25 mm/min) to locate them precisely, and
a final pull-off. It pauses for `$26` (default 250 ms) after each phase.
X and Y home together, each at the full rate. From the far end of the 380 mm
X travel: seek 15.2 s + locate 2.4 s + pull-offs 0.08 s + pauses 1.0 s =
**18.7 s**. Starting near the switches, only the seek gets shorter. Keep the
defaults for `$24`, `$26` and `$27`: the slow locate pass is what makes the
homed position repeat.

**Coordinates after homing.** In GRBL's standard build (without
`HOMING_FORCE_SET_ORIGIN`), machine coordinates after homing run from −`$130`
to 0 on X and −`$131` to 0 on Y, and soft limits reject anything outside
that. The positive coordinates `toGcode` writes therefore need either a work
offset set at the board corner (for example `G10 L20 P1 X0 Y0` with the
magnet there) or negative `offsetX` / `offsetY`. `calibrate.js` works from
the positions the builder jogs to, so with no work offset set its offsets
come out negative on their own. Without a calibration, the
last line `toGcode` writes, `G0 X0 Y0`, does not include the offsets; with
one, the job ends parked over cell (0, 0) instead.

## What Milestone 1 should measure

These replace the assumptions that decide sections 6 and 7 and the magnet's
heat in section 11 (the supply current is measured in Milestones 2 and 3,
section 11). A kitchen scale that reads 0.1 g is enough; a reading in grams × 0.00981
is the force in newtons. Use the king for the grip tests (the heaviest of the
three Milestone 1 pieces) and a pawn, the lightest piece, for step 4. Test the
pieces as the funded build has them first, with no felt on their bases; step 5
repeats the tests with felt, the optional add-back.

Before testing, check each glued washer. With no felt the washer is exposed
at the bottom of the base, and the piece should stand on the PLA ring around
it, not on the steel (section 6). Once the glue has set, lay a straight edge
across the bottom of the base: the washer must sit below the ring, clear of
the straight edge. Measure one washer's thickness too; the pocket is 1.8 mm
deep for a 1.6 mm washer.

For every force test:

- Hold the magnet in a fixed stand (a clamp, or blocks and tape), touching neither the scale nor the board sample. A magnet held by hand, or pressed against the sample, gives wrong readings (step 2 explains why).
- Set the gap with a sheet of paper: raise the magnet until its face just traps the sheet against the underside of the sample, then slide the sheet out. The paper's thickness, about 0.1 mm, stands in for the PTFE tape, so take the tape off the magnet for these tests.

1. **Friction μ.** Put a piece with no felt on a sample of the board sheet with the magnet off and tilt the sample until the piece slides. μ = tan(angle). Weigh the piece: μ × its weight is what step 3 should find with the magnet off.
2. **Centred pull F_v.** Stand the board sample on two blocks on the scale, with the magnet in its stand underneath as above. First, with nothing on the sample, switch the magnet on: the reading should not move. If it does, the magnet is pulling on steel in the scale; raise the blocks. Then switch the magnet off, put the king over the magnet's centre, and tare. Switch the magnet on: the rise in the reading is F_v. Do not let the magnet touch the sample. If it did, the washer's pull on the magnet would push the magnet up into the sample with the same force that pulls the piece down, the two would cancel, and the scale would show only how hard the stand pushes.
3. **Sideways pull.** Loop a thread round the bottom of the king's base, at the washer, about 1 mm up (2 mm with felt; tied higher, the king tips over before it slides). Run the thread level to a pulley that turns freely at the edge of the sample, such as a cotton reel on a pencil, and hang from it a pouch of foil or paper weighing well under 1 g. Add rice grains one at a time until the king breaks away from the magnet (it may creep a millimetre or two first), then weigh the pouch with its rice. That is the pull, in grams.
   - With the magnet off: T0. It should match μ × weight from step 1. If it is clearly more, the pulley is dragging; fix it before going on.
   - With the magnet on and the king centred over it: T1.

   T1 is the magnet's peak sideways pull plus the friction μ (weight + F_v). A drag needs that sideways pull to beat the same friction again, plus m a (at most 0.0019 N, 0.2 g, at 400 mm/s²). So the king will follow the magnet if **T1 ≥ 2 μ (weight + F_v) + m a**, with μ from step 1 and F_v from step 2. That is on the safe side, because the downward pull is weaker where the sideways pull peaks. Comfortably more is better.
4. **Standing pieces.** Put a pawn with its centre 20 mm from the magnet's axis and repeat step 3 on it, pulling it straight away from the magnet: T0 with the magnet off, T1 with it on. T1 − T0 is at least the sideways pull a passing magnet puts on a standing pawn (it also includes some extra friction from the magnet's downward pull). If T1 − T0 is less than T0, a passing magnet cannot pull a standing pawn along; aim for well under half of T0. Then check it directly: with the magnet on, slide it along a straight edge under the sample so that the king it drags passes a standing pawn with their centres 20 mm apart. Do it ten times and check that the pawn does not move.
5. **Repeat 1 to 4 with a felt pad** on each base, and 2 to 4 with a plain steel disc in place of the washer, to see what each change buys. Felt changes both the friction and the gap (section 7: with bare PLA at μ = 0.3, felt helps grip only if its μ is below about 0.26, or 0.20 on the low estimate's slope), so compare the step 3 results, not μ alone. A change only helps if it still passes step 4.
6. **Magnet temperature.** Mount the magnet the way the carriage will hold it, against a board sample, with a thermometer probe taped to its body. Log the temperature every 5 minutes until it stops rising, about 30 minutes. (The model's time constant is about 10 minutes, so a reading at 10 minutes shows only about two thirds of the final rise.) Do it twice: switched on continuously, and at the reset job's duty of about 71%, for example 5 s on and 2 s off (from GRBL, repeat `M8`, `G4 P5`, `M9`, `G4 P2`). Compare the final rises with the model's 159 K and 113 K. If the body passes about 60 °C, switch off: that already answers the question for a PLA carriage, and the readings so far still show how fast it heats.
7. **Where the piece stops** relative to the magnet's centre after a drag.

## Sources

Checked on 2026-10-01, and the additions noted below on 2026-10-02:

- GRBL 1.1 README (30 kHz step rate on the ATmega328p; `G53` in its list of supported commands, checked 2026-10-02): https://github.com/gnea/grbl
- GRBL 1.1 source code, in https://github.com/gnea/grbl/tree/master/grbl: `planner.c` (junction deviation, per-axis speed and acceleration limits), `nuts_bolts.c` (`limit_value_by_axis_maximum`), `coolant_control.c` (`M8`/`M9` wait for the buffer to empty), `config.h` (`MAX_STEP_RATE_HZ` 30000, switched off; `HOMING_CYCLE_0 (1<<Z_AXIS)` then `HOMING_CYCLE_1` for X and Y, and the two-axis example `HOMING_CYCLE_0 ((1<<X_AXIS)|(1<<Y_AXIS))`; `N_HOMING_LOCATE_CYCLE` 1), `defaults.h` (`$1` = 25 ms, with 255 keeping the drivers enabled, checked 2026-10-02; `$11` = 0.010 mm, `$23` = 0, `$24` = 25 mm/min, `$25` = 500 mm/min, `$26` = 250 ms, `$27` = 1.0 mm), `settings.c`, `system.c`, `stepper.c` (`st_go_idle` switches the drivers off after `$1` unless it is 255; checked 2026-10-02), `motion_control.c` (`$H` runs `HOMING_CYCLE_0` then `HOMING_CYCLE_1`) and `limits.c` (travel limits stored as negative; machine position after homing; the four homing phases, the `$26` pause after each, each axis at the full homing rate, search over 1.5 × the travel, alarm 9 when no switch is found), and `doc/csv/alarm_codes_en_US.csv` (alarm 9)
- GRBL v1.1 configuration guide (`$5`, `$23`): https://github.com/gnea/grbl/wiki/Grbl-v1.1-Configuration
- Eclipse Magnetics electro-holding magnets datasheet, 20 mm model M52180/12VDC (20 mm × 18 mm, 36 g, 53 N, 2.5 W at 12 V 210 mA, 100% duty, pull versus air gap in whole newtons ±10%, on the M52171/25ARM armature, 25 mm × 3 mm): https://www.eclipsemagnetics.com/site/assets/files/7761/electromagnets_-_energise_to_hold.pdf
- Adafruit 5 V electromagnet, P20/15 (2.5 kg holding force, 20 mm × 15 mm, 8 mm centre, 22.7 g): https://www.adafruit.com/product/3872
- ShillehTek P20/15 12 V manual (up to 3 kg, about 0.2–0.25 A, continuous operation supported, coil "runs warm"): https://shillehtek.com/blogs/shillehtek-product-manuals/electromagnet-solenoid-12v-3kg-p20-15-manual
- 17HS4401 listing, the X motor's figures (1.8°, 40 N·cm, 1.5 A, 1.5 Ω per coil, 2.8 mH, 54 g·cm²; it does not say how the holding torque is measured; it also gives a rated voltage of 3.6 V, checked 2026-10-02): https://www.bitsandparts.nl/en/stepper-motor-nema-17-17hs4401-p1910324
- 17HS15-1504S-X1 product page, the Y motor's figures (1.8°, 45 N·cm, 1.5 A, 2.3 Ω per phase, 4.4 mH ±20% at 1 kHz, 280 g; a 40 mm body): https://www.omc-stepperonline.com/nema-17-bipolar-45ncm-63-74oz-in-1-5a-42x42x39mm-4-wires-w-1m-pin-connector-17hs15-1504s-x1. Its "Torque Curves" tab shows the pull-out curve used in section 2 (24 V, 1.5 A, 2000 microsteps per turn, driver not named), read from the plotted points of https://www.omc-stepperonline.com/image/catalog/torque-curves/17HS15-1504S-X1_Torque_Curve.svg
- The same motor's Amazon listing, the one the BOM buys (the same electrical figures; it gives a 39 mm body): https://www.amazon.com/dp/B07LF898KN
- Allegro A4988 datasheet, 4988-DS Rev. 8 (output on-resistance Rds(on) of each source or sink transistor 320 mΩ typical, 430 mΩ maximum at 1.5 A, TA = 25 °C; motor supply current IBB at most 4 mA; crossover dead time 475 ns typical; synchronous rectification during current decay; current trip-level error ±5% at VREF = 2 V and 70.71% or 100% of ITripMAX, ±15% at 38.27%, nothing given at other VREF values, checked 2026-10-02): https://www.allegromicro.com/-/media/files/datasheets/a4988-datasheet.pdf
- Pololu A4988 carrier (current limit = Vref ÷ (8 × Rs), sense resistor values, both coils at about 70% of the limit in full-step mode): https://www.pololu.com/product/1182

Not found, so left as assumptions: a force-versus-gap curve for the P20/15
itself, its pull at an offset from its axis, its temperature when left on,
the friction of bare printed PLA or of felt on paper, the sideways-to-downward
pull ratio s, a manufacturer's mass for the LM8UU, the pull-out torque curve
of a 17HS4401, the conditions either motor's holding torque is rated under,
the 17HS15-1504S-X1's rotor inertia (StepperOnline's full datasheet for it is
a download from the product page and was not opened), the A4988's switching
losses and its on-resistance when hot, the motors' iron losses, the X
motor's true coil resistance (its listing gives both 1.5 Ω and a 3.6 V
rating at 1.5 A), the A4988's current-limit accuracy at a Vref of 0.84 V,
and a torque constant or back-EMF figure for either motor (section 2 derives
one from the holding torque). Not looked for: how warm the motor windings
get in use (section 11 tries 50 K), the thickness tolerance of the M8
washers, and the friction of steel on paper (both section 6).
