# Parts list (funded build)

Everything needed for the compact v1 board in [DESIGN.md](DESIGN.md): an XY
gantry that moves an electromagnet under a 400 × 320 mm board top. This is
the list submitted for the $100 tier 3 funding. Four parts were cut or
downgraded to fit the budget; they, and other parts that would improve the
board, are listed under [Add back when building](#add-back-when-building),
to be bought separately at build time. The design works either way.

Prices are in US dollars for a US buyer, and every row was checked on
2026-10-01. Amazon and eBay rows were checked on the product page itself.
AliExpress blocks automated visits to its product pages, so AliExpress rows
were checked in the quick-view panel of its search results, with the exact
variant selected. Each price is the regular price anyone pays; AliExpress's
$1.09 "new shoppers" deals are left out. Three rows are sales that anyone gets
right now (rows 3, 6 and 12); see [Prices that can change](#prices-that-can-change).

**Total: $98.36, which is $1.64 under the $100 tier 3 budget.**

| # | Part | What it's for | Qty | Unit $ | Line $ | Vendor | Link |
|---|---|---|---|---|---|---|---|
| 1 | Arduino Uno R3 + CNC Shield V3 + 4 × A4988 drivers with heatsinks, USB cable (kit) | Uno runs GRBL 1.1; the shield drives both motors, switches the magnet from CoolEn (A3) and reads the X−/Y− endstops | 1 | 7.88 | 7.88 | AliExpress (Realpoy Module Wholesale Store) | https://www.aliexpress.us/item/3256806291794239.html |
| 2 | STEPPERONLINE NEMA 17 stepper, 45 N·cm, 1.5 A, 39 mm body, 1 m cable | Y axis motor (moves the whole gantry); also lifts the Amazon order over $35 so it ships free | 1 | 12.99 | 12.99 | Amazon (sold by StepperOnline) | https://www.amazon.com/dp/B07LF898KN |
| 3 | NEMA 17 stepper 17HS4401, 1.5 A, 40 mm body, with Dupont cable | X axis motor (moves only the magnet carriage) | 1 | 5.25 | 5.25 | AliExpress (JINGLIN 3D Store) | https://www.aliexpress.us/item/3256808478690312.html |
| 4 | Linear rods, 8 mm × 500 mm, case-hardened chrome, pack of 4 | Two Y rods on the base, two X rods on the gantry | 1 | 23.99 | 23.99 | Amazon (sold by Sharp Domain Hardware, ships from Amazon) | https://www.amazon.com/dp/B0C2MJMMQM |
| 5 | GT2 6 mm belt 5 m + 2 × 20T pulleys (5 mm bore) + 2 × 20T idlers (5 mm bore) (kit) | Belts, motor pulleys and the two belt idlers | 1 | 7.67 | 7.67 | AliExpress (KUFAN 3D Printer Store) | https://www.aliexpress.us/item/3256809943699118.html |
| 6 | LM8UU linear ball bearing 8 × 15 × 24 mm, lot of 10 | Gantry end blocks (2 per Y rod) and the magnet carriage (8 used) | 1 | 6.59 | 6.59 | AliExpress (BN-Bearing Store) | https://www.aliexpress.us/item/3256808328579983.html |
| 7 | 12 V holding electromagnet HCNE1-P20/15 (20 × 15 mm, M3 thread, 3 W) | Grabs the steel washer in each piece through the board top | 1 | 3.95 | 3.95 | AliExpress (Hardware appliances store) | https://www.aliexpress.us/item/3256807419633345.html |
| 8 | MOSFET trigger switch module, 15 A 400 W, DC 5–36 V | Switches the magnet from GRBL's CoolEn pin: `M8` on, `M9` off | 1 | 2.03 | 2.03 | AliExpress (Jujiasheng Electronics store) | https://www.aliexpress.us/item/3256809498020632.html |
| 9 | 1N5819 Schottky diode, 1 A 40 V, DO-41, lot of 100 | Flyback diode across the magnet coil (1 used) | 1 | 2.07 | 2.07 | AliExpress (InShop Chip Store) | https://www.aliexpress.us/item/2251832821661353.html |
| 10 | Mechanical endstop switch board with cable (RAMPS style) | Homing switches on X and Y | 2 | 1.72 | 3.44 | AliExpress (YX Electronic Components) | https://www.aliexpress.us/item/3256809234716436.html |
| 11 | 12 V 3 A AC/DC adapter, US plug | Powers the motors (through the shield) and the magnet | 1 | 2.66 | 2.66 | AliExpress (GBKOF LED Factory Store) | https://www.aliexpress.us/item/3256808383701455.html |
| 12 | Inline 5 × 20 mm glass fuse holder with 22 AWG leads and 5 A fuses, 5 sets | Fuse on the +12 V line, before everything else | 1 | 2.45 | 2.45 | AliExpress (Choice listing) | https://www.aliexpress.us/item/3256807619256072.html |
| 13 | M8 flat washer, zinc-plated carbon steel, lot of 10 | Steel insert in each of the 34 piece bases | 4 | 1.31 | 5.24 | AliExpress (MSLPJ Store) | https://www.aliexpress.us/item/3256803033699156.html |
| 14 | PTFE-coated fiberglass tape, 0.13 mm thick, 10 mm wide, 10 m | Low-friction face on the magnet where it slides against the board top | 1 | 2.91 | 2.91 | AliExpress (The Nineteenth Century Store) | https://www.aliexpress.us/item/3256810401333660.html |
| | **Parts** | | | | **89.12** | | |
| | **Tax and shipping (estimate)** | $8.91 sales tax at 10.000% + $0.33 shipping | | | **9.24** | | |
| | **Total** | | | | **98.36** | | |

## Notes per row

Pick the variant named here; most listings open on a different one.

1. Variant "A4988 Green Kit". The listing photo shows the Uno, USB cable,
   shield, four drivers and heatsinks. The USB chip isn't named; it is most
   likely a CH340, which needs the CH340 driver on some computers. Only two of
   the four drivers are used.
2. "Number of Items: 1". The page lists 17HS15-1504S-X1, 45 N·cm, 1.5 A.
   It goes on the Y axis, which moves the whole gantry, X motor included.
   Amazon ships free only when Amazon-shipped items total $35 or more, so keep
   this motor and the rods (row 4) in the same order ($36.98).
3. Variants "1PCS" and "17HS4401 Dupont". It goes on the X axis, where it
   rides on the gantry: the CAD allows a body up to 51 mm long.
   [CALCULATIONS.md](CALCULATIONS.md) sizes the X axis from this motor's
   listing and finds about 3× torque margin.
   $5.25 is a sale price, one per shopper, ending Oct 7; the regular price is
   $12.38. The variant name suggests a cable with a Dupont plug that fits the
   shield's motor pins, but the listing wasn't checked for what the cable
   includes.
4. Size "D 8mm x L 500mm 4 PCS" (the page also offers 400 mm). Free delivery
   was estimated Oct 19 to Nov 13.
5. Variant "20PCS DIY KIT". Free shipping. About 2.2 m of the 5 m belt is
   used. The two idlers (5 mm bore) come from the kit's description as read in
   research; the quick view didn't list the kit's contents. The CAD is drawn
   for them by default (M5 axles). If the kit arrives without idlers, buy the
   3 mm idlers under [Add back when building](#add-back-when-building) and
   print the two idler parts for 3 mm
   ([cad/README.md: Using 3 mm idlers](../cad/README.md#using-3-mm-idlers)).
6. Variant "Lm8uu". $6.59 is a store sale ending Oct 7 (regular $7.94), and
   this is the only row that charges shipping ($0.33).
7. Variants "Voltage: 12V" and "P20-15". It screws onto the M3 guide screw in
   the carriage ([cad/README.md](../cad/README.md)).
8. Variant "1pcs MOSFET Trigger". This is the common dual-MOSFET module
   (VIN+/VIN−, OUT+/OUT−, TRIG/PWM and GND), triggered by 3.3–20 V, so the
   Arduino's 5 V turns it fully on. Check that the chips are marked D4184.
   It has no flyback diode of its own, so row 9 is required.
9. Only one diode is used; the lot is the cheapest way to buy it.
10. Variant "1PCS", quantity 2. The quick view showed "Max. 1 pcs/shopper",
    which is the new-shopper limit; buying two at the regular price wasn't
    tried in a cart. If the cart refuses, the 6PCS variant is $4.70. Wire
    them as the [schematic](img/wiring.png) shows: S to X−/Y−, − to the pin
    beside it, + not connected. The CAD models a 40 × 16 mm board with holes
    35 mm apart; measure yours before printing the mounts.
11. Variants "US Plug", "12V", "3A". No-name adapter, not UL listed. The
    machine is estimated to draw about 0.87 A, a 3.4× margin; the worst-case
    bound, every coil at full current at once, is 3.22 A
    ([CALCULATIONS.md §11](CALCULATIONS.md#11-power-budget-and-magnet-heat)).
    Measure the draw while homing and moving in Milestone 2, and during the
    reset job with the magnet in Milestone 3. The 5 A variant of the same
    listing is an add-back. If you cut off the
    barrel plug, find +12 V with a meter before connecting anything: the
    shield has no reverse-polarity protection.
12. Variant "AMP: 5A". $2.45 is a sale (list price $5.22); the end date isn't
    shown. The 5 A fuse stays with either adapter. The 22 AWG leads are thin
    for 5 A, so keep them short.
13. Variant "10pcs M8", quantity 4 (40 washers for 34 pieces). Zinc-plated
    carbon steel is magnetic. **Never use stainless washers**: they are barely
    magnetic. The listing doesn't state the outer diameter. A standard M8
    washer is 16 mm and the pocket in [cad/pieces.scad](../cad/pieces.scad) is
    16.4 mm, so measure one when they arrive. The quantity note from row 10
    applies here too.
14. Variant "10mm Width-10M-Roll". Lay two strips side by side to cover the
    magnet's 20 mm face.

## Tax and shipping

This is an estimate; no cart or checkout was opened.

- **Sales tax: $8.91.** That is 10.000% of $89.12, San Jose's rate since
  Measure A took effect on 2026-04-01. Elsewhere in Santa Clara County the
  rate is 9.75% ($8.69). AliExpress, Amazon and eBay all collect California
  sales tax.
- **Shipping: $0.33**, on row 6 only. The other AliExpress rows showed free
  shipping, and Amazon ships free because rows 2 and 4 total $36.98.
- **Import charges:** none were shown. If AliExpress adds any at checkout,
  add a few dollars.

The order splits two ways: AliExpress $52.14 (12 rows) and Amazon $36.98.

## Prices that can change

- **Row 3 (X motor):** $5.25 is a sale, one per shopper, ending Oct 7. At its
  regular $12.38 the total would be $106.21.
- **Row 6 (bearings):** sale until Oct 7; regular $7.94 (+$1.49 with tax).
- **Row 12 (fuse holders):** sale with no end date shown; list $5.22
  (+$3.05 with tax).
- **Rows 10 and 13:** more than one of the same AliExpress item; the price of
  the second unit wasn't tried in a cart.

## What was cut to fit the budget

The full-spec list came to $116.38. These four changes bring it to $98.36:

| Change | Saves (with tax) | Effect on the build |
|---|---|---|
| The belt kit's two 5 mm-bore idlers replace a separate pack of 3 mm-bore idlers | $6.80 | None: the CAD's idler bore is a setting, 5 mm by default, with M5 axles |
| No felt pads under the pieces | $2.17 | Pieces slide on their printed bases. Less gap means more grip ([CALCULATIONS.md §7](CALCULATIONS.md#7-grip-does-the-piece-follow-the-magnet)); Milestone 1 decides whether felt is worth adding |
| 12 V 3 A adapter instead of 5 A | $3.28 | Less headroom; see row 11 |
| A 17HS4401 on X instead of a second STEPPERONLINE 45 N·cm motor | $5.78 | 40 N·cm instead of 45 on the X axis, which moves only the light carriage. The calculations size each axis from its own motor's listing: about 3× torque margin on both |

## Add back when building

Not part of the funding request: parts to buy separately at build time,
because they make the board better or back up a risky part. Prices were seen
on 2026-10-01 where given; check them again when ordering.

| Part | Why add it | Price seen | Link | What changes |
|---|---|---|---|---|
| GT2 20T toothed idlers, 3 mm bore, pack of 4 (variant "20T W6 B3 With T", "4pcs") | Only if the belt kit arrives without idlers, or as spares | $6.18 | https://www.aliexpress.us/item/3256807370977153.html | Print the idler end block and the Y idler mount for 3 mm ([cad/README.md: Using 3 mm idlers](../cad/README.md#using-3-mm-idlers)); M3 axles instead of M5 |
| Self-adhesive felt circles, 20 mm, 48 (variant "Black 20mm 48pcs") | Quieter moves, protects the board sheet, steadier sliding if bare PLA or the washer scuffs or sticks | $1.97 | https://www.aliexpress.us/item/3256811410708037.html | Trim each to about 18 mm. It adds about 1 mm to the magnet gap, which weakens the pull ([CALCULATIONS.md §7](CALCULATIONS.md#7-grip-does-the-piece-follow-the-magnet)), so let Milestone 1 decide |
| 12 V 5 A adapter (variant "US Plug", "12V", "5A" of row 11) | Headroom above the 3.22 A worst-case bound; the estimated draw is 0.87 A, so this is insurance rather than a need | $5.64 | https://www.aliexpress.us/item/3256808383701455.html | Nothing; same wiring and fuse |
| Second STEPPERONLINE 45 N·cm motor | A matched pair, more torque on X | $10.50 (eBay, showed "Last one") or $12.99 (Amazon, row 2) | https://www.ebay.com/itm/264814082447 | Nothing; it is 39 mm long, under the X motor's 51 mm limit |
| Spare MOSFET modules (variant "5pcs MOSFET Trigger" of row 8) | Spares for the part most likely to be damaged by a wiring mistake | $3.68 | https://www.aliexpress.us/item/3256809498020632.html | Nothing |
| Spare P20/15 electromagnet (row 7) | Grip is the biggest risk, and Milestone 1 tests the magnet before anything else; a second one also lets you compare | $3.95 | https://www.aliexpress.us/item/3256807419633345.html | Nothing |
| Female DC barrel jack to screw terminal adapter, 5.5 × 2.1 mm | Wires the adapter without cutting its plug, with + and − marked: avoids reversed polarity | not checked | | Nothing |

A stronger magnet (for example a P25/20) is the usual fix if Milestone 1
shows the P20/15 can't drag a king, but the carriage's sleeve and spring are
drawn for a 20 × 15 mm magnet and would have to be redrawn.

## Already on hand (not funded)

- Access to a 3D printer and about 320 g of PLA: about 260 g for the gantry
  parts ([cad/README.md](../cad/README.md)) and about 60 g for the 34 pieces
  ([cad/pieces.scad](../cad/pieces.scad))
- A plywood or MDF base about 600 × 500 mm, a 3 mm hardboard (smooth on both
  sides) or MDF sheet for the board top, and wood strips for the frame walls
- Screws: M3 screws and nuts, including 12 grub screws, 9 countersunk
  M3 × 10 and an M3 × 25 guide screw for the magnet; for the idler axles an
  M5 × 30 and an M5 × 20 socket screw, 2 M5 nuts and 4 M5 washers; about 19
  wood screws (the hardware table in [cad/README.md](../cad/README.md) has
  the full list)
- A light spring for the magnet carriage, for example from a retractable
  ballpoint pen (about 5–6 mm across and 20 mm long)
- Hookup wire (18–22 AWG), zip ties, a soldering iron and solder
- Superglue or epoxy to fix the washers into the piece bases
- A multimeter, to set each A4988's current limit, find the adapter's +12 V
  and measure the machine's current draw
- A computer or Raspberry Pi (a USB cable comes with row 1)
- Paper and a printer for the board sheet ([cad/board-sheet.svg](../cad/board-sheet.svg))

## Upgrades later (not in this budget)

| Upgrade | Why |
|---|---|
| TMC2209 drivers instead of A4988 | Nearly silent motors |
| 2020 aluminium extrusion frame | Stiffer, easier to square up |
| 50 mm squares, two storage columns per side | Bigger pieces, room for every captured piece |
| Reed switches or Hall sensors under every square | Detect moves made by hand (Milestone 5 in the roadmap) |
