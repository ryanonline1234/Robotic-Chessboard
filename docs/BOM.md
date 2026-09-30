# Parts list (funded build)

Everything needed for the compact v1 board in [DESIGN.md](DESIGN.md): an
XY gantry that moves an electromagnet under a 400 × 320 mm board top.
Prices are estimates from typical online listings, in US dollars, before
shipping and tax. Check current prices before ordering.

| # | Part | Qty | Est. price | Used for |
|---|---|---|---|---|
| 1 | Arduino Uno R3 (compatible) | 1 | $9 | Runs GRBL, the motion firmware |
| 2 | CNC Shield V3 with A4988 stepper drivers | 1 kit | $9 | Drives the two motors, magnet output on the coolant pin |
| 3 | NEMA 17 stepper motor, 40 N·cm or more, 1.5 A | 2 | $20 | X and Y axes |
| 4 | GT2 6 mm belt (5 m), 2 × 20-tooth pulleys (5 mm bore), 4 idlers | 1 kit | $9 | Moves the carriages |
| 5 | 8 mm smooth rod, 500 mm | 4 | $16 | Linear rails, two per axis |
| 6 | LM8UU linear bearing | 12 (1 pack) | $6 | Carriages slide on the rods |
| 7 | 12 V holding electromagnet, 20 × 15 mm (P20/15 type) | 1 | $6 | Grabs the pieces through the board |
| 8 | Logic-level MOSFET module (AOD4184 type) | 1 (pack) | $3 | Switches the magnet from the Arduino |
| 9 | 1N5819 Schottky diode | 1 (pack) | $1 | Flyback protection across the magnet coil |
| 10 | Mechanical endstop switch | 2 (pack of 3) | $3 | Homing the X and Y axes |
| 11 | 12 V 5 A power supply, enclosed | 1 | $10 | Motors and magnet |
| 12 | Inline fuse holder + 5 A fuse | 1 | $2 | Protects the 12 V line |
| 13 | M8 flat washer, 16 mm across | 50 (1 pack) | $3 | Steel insert in each piece base |
| 14 | Self-adhesive felt sheet | 1 | $2 | Pads under the pieces |
| | **Total** | | **≈ $99** | |

## Already on hand (not funded)

- Access to a 3D printer and about 250 g of PLA: 34 pieces
  ([cad/pieces.scad](../cad/pieces.scad)) plus rod holders, carriages and
  motor mounts
- A plywood or MDF base about 600 × 500 mm, and a 3 mm hardboard or MDF
  sheet for the board top
- M3 and wood screws, hookup wire, a soldering iron, a USB cable, a computer
- Paper to print the board sheet ([cad/board-sheet.svg](../cad/board-sheet.svg))

## Upgrades later (not in this budget)

| Upgrade | Why |
|---|---|
| TMC2209 drivers instead of A4988 | Nearly silent motors |
| 2020 aluminium extrusion frame | Stiffer, easier to square up |
| 50 mm squares, two storage columns per side | Bigger pieces, room for every captured piece |
| Reed switches or Hall sensors under every square | Detect moves made by hand (Milestone 5 in the roadmap) |
