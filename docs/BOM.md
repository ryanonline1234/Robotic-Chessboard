# Parts list (funded build)

Everything needed for the compact v1 board in [DESIGN.md](DESIGN.md): an XY
gantry that moves an electromagnet under a 400 × 320 mm board top. Prices are
in US dollars for a US buyer, and every row was checked on 2026-10-01. Amazon
and eBay rows were checked on the product page itself. AliExpress blocks
automated visits to its product pages, so AliExpress rows were checked in the
quick-view panel of its search results, with the exact variant selected.

Each price is the regular price anyone pays. AliExpress also shows $1.09
"new shoppers" deals (one per item, new accounts only); those are left out.
Two rows are store sales that anyone gets right now (rows 7 and 13); if they
end, the total rises by $4.12 plus tax.

**Total: $116.38, which is $16.38 over the $100 tier 3 budget.** The parts
alone come to $105.50. [Getting under $100](#getting-under-100) lists the
changes that close the gap and what each one costs the design.

| # | Part | What it's for | Qty | Unit $ | Line $ | Vendor | Link |
|---|---|---|---|---|---|---|---|
| 1 | Arduino Uno R3 + CNC Shield V3 + 4 × A4988 drivers with heatsinks, USB cable (kit) | Uno runs GRBL 1.1; the shield drives both motors, switches the magnet from CoolEn (A3) and reads the X−/Y− endstops | 1 | 7.88 | 7.88 | AliExpress (Realpoy Module Wholesale Store) | https://www.aliexpress.us/item/3256806291794239.html |
| 2 | STEPPERONLINE NEMA 17 stepper, 45 N·cm, 1.5 A, 39 mm body, 1 m cable | First axis motor; also lifts the Amazon order over $35 so it ships free | 1 | 12.99 | 12.99 | Amazon (sold by StepperOnline) | https://www.amazon.com/dp/B07LF898KN |
| 3 | STEPPERONLINE NEMA 17 stepper, 45 N·cm, 1.5 A, 39 mm body, 1 m cable | Second axis motor | 1 | 10.50 | 10.50 | eBay (STEPPERONLINE CNC Store) | https://www.ebay.com/itm/264814082447 |
| 4 | Linear rods, 8 mm × 500 mm, case-hardened chrome, pack of 4 | Two Y rods on the base, two X rods on the gantry | 1 | 23.99 | 23.99 | Amazon (sold by Sharp Domain Hardware, ships from Amazon) | https://www.amazon.com/dp/B0C2MJMMQM |
| 5 | GT2 6 mm belt 5 m + 2 × 20T pulleys (5 mm bore), clips and fixing pieces (kit) | Belts for both axes and the two motor pulleys | 1 | 7.67 | 7.67 | AliExpress (KUFAN 3D Printer Store) | https://www.aliexpress.us/item/3256809943699118.html |
| 6 | GT2 20-tooth toothed idler with bearings, 3 mm bore, 6 mm belt, pack of 4 | Idlers at the far end of the X and Y belt loops (2 used) | 1 | 6.18 | 6.18 | AliExpress (Dolyper 3D Store) | https://www.aliexpress.us/item/3256807370977153.html |
| 7 | LM8UU linear ball bearing 8 × 15 × 24 mm, lot of 10 | Gantry end blocks (2 per Y rod) and the magnet carriage (8 used) | 1 | 6.59 | 6.59 | AliExpress (BN-Bearing Store) | https://www.aliexpress.us/item/3256808328579983.html |
| 8 | 12 V holding electromagnet HCNE1-P20/15 (20 × 15 mm, M3 thread, 3 W) | Grabs the steel washer in each piece through the board top | 1 | 3.95 | 3.95 | AliExpress (Hardware appliances store) | https://www.aliexpress.us/item/3256807419633345.html |
| 9 | MOSFET trigger switch module, 15 A 400 W, DC 5–36 V | Switches the magnet from GRBL's CoolEn pin: `M8` on, `M9` off | 1 | 2.03 | 2.03 | AliExpress (Jujiasheng Electronics store) | https://www.aliexpress.us/item/3256809498020632.html |
| 10 | 1N5819 Schottky diode, 1 A 40 V, DO-41, lot of 100 | Flyback diode across the magnet coil (1 used) | 1 | 2.07 | 2.07 | AliExpress (InShop Chip Store) | https://www.aliexpress.us/item/2251832821661353.html |
| 11 | Mechanical endstop switch board with cable (RAMPS style) | Homing switches on X and Y | 2 | 1.72 | 3.44 | AliExpress (YX Electronic Components) | https://www.aliexpress.us/item/3256809234716436.html |
| 12 | 12 V 5 A AC/DC adapter, US plug | Powers the motors (through the shield) and the magnet | 1 | 5.64 | 5.64 | AliExpress (GBKOF LED Factory Store) | https://www.aliexpress.us/item/3256808383701455.html |
| 13 | Inline 5 × 20 mm glass fuse holder with 22 AWG leads and 5 A fuses, 5 sets | Fuse on the +12 V line, before everything else | 1 | 2.45 | 2.45 | AliExpress (Choice listing) | https://www.aliexpress.us/item/3256807619256072.html |
| 14 | M8 flat washer, zinc-plated carbon steel, lot of 10 | Steel insert in each of the 34 piece bases | 4 | 1.31 | 5.24 | AliExpress (MSLPJ Store) | https://www.aliexpress.us/item/3256803033699156.html |
| 15 | Self-adhesive felt circles, 20 mm, black, 48 pieces | Pads under the pieces | 1 | 1.97 | 1.97 | AliExpress (U Top Store) | https://www.aliexpress.us/item/3256811410708037.html |
| 16 | PTFE-coated fiberglass tape, 0.13 mm thick, 10 mm wide, 10 m | Low-friction face on the magnet where it slides against the board top | 1 | 2.91 | 2.91 | AliExpress (The Nineteenth Century Store) | https://www.aliexpress.us/item/3256810401333660.html |
| | **Parts** | | | | **105.50** | | |
| | **Tax and shipping (estimate)** | $10.55 sales tax at 10.000% + $0.33 shipping | | | **10.88** | | |
| | **Total** | | | | **116.38** | | |

## Notes per row

Pick the variant named here; most listings open on a different one.

1. Variant "A4988 Green Kit". The listing photo shows the Uno, USB cable,
   shield, four drivers and heatsinks. The USB chip isn't named; it is most
   likely a CH340, which needs the CH340 driver on some computers. Only two of
   the four drivers are used.
2. "Number of Items: 1". The page lists 17HS15-1504S-X1, 45 N·cm, 1.5 A.
   Amazon ships free only when Amazon-shipped items total $35 or more, so keep
   this motor and the rods (row 4) in the same order ($36.98).
3. "1PC". The page showed **"Last one"**, so it may sell out. Fallbacks: a
   second Amazon motor from row 2 (+$2.49), or
   https://www.ebay.com/itm/264468429003 at $9.99 (a 17HS15-1704S, 44 N·cm,
   1.7 A; seen in research but not re-checked). Either is strong enough:
   [CALCULATIONS.md](CALCULATIONS.md) sizes the motors from a 40 N·cm
   17HS4401 and finds about 3× torque margin. The X motor rides on the gantry
   and must be no longer than 51 mm ([cad/README.md](../cad/README.md)); both
   motors here are 39 mm.
4. Size "D 8mm x L 500mm 4 PCS" (the page also offers 400 mm). Free delivery
   was estimated Oct 19 to Nov 13.
5. Variant "20PCS DIY KIT". Free shipping. About 2.2 m of the 5 m belt is
   used.
6. Variants "20T W6 B3 With T" and "4pcs" (the page opens on 16T).
7. Variant "Lm8uu". $6.59 is a store sale ending Oct 7 (regular $7.94), and
   this is the only row that charges shipping ($0.33).
8. Variants "Voltage: 12V" and "P20-15". It screws onto the M3 guide screw in
   the carriage ([cad/README.md](../cad/README.md)).
9. Variant "1pcs MOSFET Trigger". This is the common dual-MOSFET module
   (VIN+/VIN−, OUT+/OUT−, TRIG/PWM and GND), triggered by 3.3–20 V, so the
   Arduino's 5 V turns it fully on. Check that the chips are marked D4184.
   It has no flyback diode of its own, so row 10 is required.
10. Only one diode is used; the lot is the cheapest way to buy it.
11. Variant "1PCS", quantity 2. The quick view showed "Max. 1 pcs/shopper",
    which is the new-shopper limit; buying two at the regular price wasn't
    tried in a cart. If the cart refuses, the 6PCS variant is $4.70. Wire
    them as the [schematic](img/wiring.png) shows: S to X−/Y−, − to the pin
    beside it, + not connected. The CAD models a 40 × 16 mm board with holes
    35 mm apart; measure yours before printing the mounts.
12. Variants "US Plug", "12V", "5A". No-name adapter, not UL listed. Its
    5 A rating is the listing's claim; the worst-case draw is 3.22 A
    ([CALCULATIONS.md §11](CALCULATIONS.md#11-power-budget-and-magnet-heat)).
    If you cut off the barrel plug, find +12 V with a meter before connecting
    anything: the shield has no reverse-polarity protection.
13. Variant "AMP: 5A". $2.45 is a sale (list price $5.22); the end date isn't
    shown. The 22 AWG leads are thin for 5 A, so keep them short.
14. Variant "10pcs M8", quantity 4 (40 washers for 34 pieces). Zinc-plated
    carbon steel is magnetic. **Never use stainless washers**: they are barely
    magnetic. The listing doesn't state the outer diameter. A standard M8
    washer is 16 mm and the pocket in [cad/pieces.scad](../cad/pieces.scad) is
    16.4 mm, so measure one when they arrive. The quantity note from row 11
    applies here too.
15. Variant "Black 20mm 48pcs". Trim each one to about 18 mm so it stays
    inside the 19 mm base. The thickness isn't stated;
    [CALCULATIONS.md](CALCULATIONS.md) assumes about 1 mm.
16. Variant "10mm Width-10M-Roll". Lay two strips side by side to cover the
    magnet's 20 mm face.

## Tax and shipping

This is an estimate; no cart or checkout was opened.

- **Sales tax: $10.55.** That is 10.000% of $105.50, San Jose's rate since
  Measure A took effect on 2026-04-01. Elsewhere in Santa Clara County the
  rate is 9.75% ($10.29). AliExpress, Amazon and eBay all collect California
  sales tax.
- **Shipping: $0.33**, on row 7 only. The other AliExpress rows showed free
  shipping. eBay ships free (UPS Ground Saver), and Amazon ships free because
  rows 2 and 4 total $36.98.
- **Import charges:** none were shown. If AliExpress adds any at checkout,
  add a few dollars.

The order splits three ways: AliExpress $58.02 (13 rows), Amazon $36.98 and
eBay $10.50.

## Getting under $100

Every row above is needed to build the design as drawn. These are the changes
that close the $16.38 gap, with the saving including tax:

| Change | Saves | What it costs the design |
|---|---|---|
| (a) Drop row 6 and use the two 5 mm-bore idlers that come in the belt kit (row 5) | $6.80 | The idler holes in the CAD change from 3 to 5 mm, with M5 bolts (about $1, not funded). The kit's idlers come from its description in research; the quick view didn't list the kit's contents |
| (b) Drop the felt (row 15) | $2.17 | Pieces slide on bare PLA. Milestone 1 tests with and without felt anyway, and less gap means more grip ([CALCULATIONS.md §7](CALCULATIONS.md#7-grip-does-the-piece-follow-the-magnet)). Felt can be added later |
| (f) Replace row 3 with a 17HS4401 from [JINGLIN 3D Store](https://www.aliexpress.us/item/3256808478690312.html) at $5.41 (variant "1PCS", "17HS4401 XH2.54") | $5.60 | None on paper: it is the motor CALCULATIONS.md assumes. But $5.41 is a sale price, one per shopper, ending Oct 7; the regular price is $12.54 |
| (e) Buy the 12 V 3 A variant of row 12 ($2.66) | $3.28 | Below the 3.22 A worst-case bound. Real draw is lower but hasn't been measured |
| (c) Drop the endstops (row 11) | $3.78 | No homing and no soft limits: jog to a1 and set zero after every power-up (`$22=0`, `send.js --no-home`) |

Combinations: (a)+(b)+(f) comes to $101.82. Adding (e) gives $98.54, and
adding (c) instead gives $98.03. No combination of (a), (b) and (f) alone gets
under $100.

## Already on hand (not funded)

- Access to a 3D printer and about 320 g of PLA: about 260 g for the gantry
  parts ([cad/README.md](../cad/README.md)) and about 60 g for the 34 pieces
  ([cad/pieces.scad](../cad/pieces.scad))
- A plywood or MDF base about 600 × 500 mm, a 3 mm hardboard (smooth on both
  sides) or MDF sheet for the board top, and wood strips for the frame walls
- Screws: M3 screws and nuts, including 12 grub screws, 9 countersunk
  M3 × 10 and an M3 × 25 guide screw for the magnet; about 19 wood screws
  (the hardware table in [cad/README.md](../cad/README.md) has the full list)
- A light spring for the magnet carriage, for example from a retractable
  ballpoint pen (about 5–6 mm across and 20 mm long)
- Hookup wire (18–22 AWG), zip ties, a soldering iron and solder
- Superglue or epoxy to fix the washers into the piece bases
- A multimeter, to set each A4988's current limit and find the supply's +12 V
- A computer or Raspberry Pi (a USB cable comes with row 1)
- Paper and a printer for the board sheet ([cad/board-sheet.svg](../cad/board-sheet.svg))

## Upgrades later (not in this budget)

| Upgrade | Why |
|---|---|
| TMC2209 drivers instead of A4988 | Nearly silent motors |
| 2020 aluminium extrusion frame | Stiffer, easier to square up |
| 50 mm squares, two storage columns per side | Bigger pieces, room for every captured piece |
| Reed switches or Hall sensors under every square | Detect moves made by hand (Milestone 5 in the roadmap) |
