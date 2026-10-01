# Parts list draft (unverified)

Research from 2026-10-01 for the funding form. **Not verified yet:** vendor sites blocked page fetches, so every price comes from search results (two are estimates). Check each link is live, is the right variant, and shows this price before typing it into the form.

Parts total **$106.57** + estimated tax and shipping **$14** = about **$120.57**, which is about $21 over the $100 tier 3 budget.

| # | Part | What it's for | Qty | Unit $ | Vendor | Link | Price seen in |
|---|---|---|---|---|---|---|---|
| 1 | Arduino Uno R3 compatible board (ATmega328P, CH340 USB), with USB cable | Runs GRBL 1.1, the motion firmware; takes G-code over USB | 1 | 3.10 | AliExpress | https://www.aliexpress.com/item/1005005033372920.html | search result |
| 2 | CNC Shield V3 with 4x A4988 stepper drivers (heatsinks included) | Drives the X and Y motors; magnet output on CoolEn (A3); X-/Y- endstop inputs | 1 | 6.00 | AliExpress | https://hz.aliexpress.com/i/1005004333918829.html | estimate |
| 3 | STEPPERONLINE NEMA 17 stepper 17HS15-1504S-X1 (45 N·cm, 1.5 A, 42x42x39 mm, 5 mm D-shaft, 1 m cable) | X and Y axis motors | 2 | 10.50 | eBay (STEPPERONLINE store) | https://www.ebay.com/itm/264814082447 | search result |
| 4 | GT2 6 mm belt 5 m + 8x GT2 20-tooth pulleys (5 mm bore) + 8 tensioner springs (SIBOOR kit) | Belt for both axes and the 2 motor pulleys | 1 | 7.21 | AliExpress (SIBOOR store) | https://www.aliexpress.us/item/3256803955372331.html | search result |
| 5 | GT2 20-tooth idler pulley with bearings, 3 mm bore, 6 mm belt | 4 idlers at the far ends of the X and Y belt loops | 4 | 0.99 | AliExpress | https://www.aliexpress.com/item/32817328238.html | search result |
| 6 | 8 mm x 500 mm hardened chrome linear shaft, pack of 4 | Linear rods: 2 for Y (frame), 2 for X (gantry) | 1 | 25.03 | AliExpress | https://www.aliexpress.com/item/32420848964.html | search result |
| 7 | LM8UU linear ball bearing 8x15x24 mm, 10 pieces | Gantry (2 per Y rod) and magnet carriage on the X rods | 1 | 6.70 | AliExpress | https://www.aliexpress.com/item/32824974095.html | search result |
| 8 | 12 V holding electromagnet P20/15 (20 mm x 15 mm, M3 thread in back, about 0.25 A) | Grabs the steel washer in each piece through the board top | 1 | 2.07 | AliExpress | https://www.aliexpress.com/i/32575060483.html | search result |
| 9 | MOSFET trigger switch module, 15 A 400 W (dual AOD4184A, 'D4184'), DC 5-36 V | Switches the magnet from GRBL's CoolEn pin (M8 on / M9 off) | 1 | 0.84 | AliExpress (TZT store) | https://www.aliexpress.us/item/2251832616690670.html | search result |
| 10 | 1N5819 Schottky diode, 1 A 40 V, DO-41, 100 pieces | Flyback diode across the magnet coil (stripe to +12 V) | 1 | 1.76 | AliExpress | https://www.aliexpress.us/item/2251832721655738.html | search result |
| 11 | Mechanical endstop switch board with cable (RAMPS style), 6 pieces | Homing switches on X- and Y- | 1 | 4.63 | AliExpress (Mayitr) | https://www.aliexpress.com/i/32888904135.html | search result |
| 12 | 12 V 5 A (60 W) AC/DC adapter, US plug, 100-240 V input | Powers the motors (through the shield) and the magnet | 1 | 9.71 | AliExpress | https://www.aliexpress.us/item/2251832773179348.html | search result |
| 13 | Inline blade fuse holder, 18 AWG, waterproof, with 5 A blade fuse | Protects the 12 V line to the shield and the MOSFET module | 1 | 0.80 | AliExpress | https://www.aliexpress.com/item/1005006386616642.html | search result |
| 14 | M8 flat washer, GB97/DIN125, black grade 8.8 carbon steel (8.4 x 16 x 1.6 mm), 50 pieces | Steel insert glued into each of the 34 piece bases for the magnet to grab | 1 | 4.00 | AliExpress (HZYUEGOU store) | https://www.aliexpress.us/item/2255801110777664.html | estimate |
| 15 | Self-adhesive felt furniture pad roll, 1 m | Felt pads under the pieces (34 discs, 19 mm) | 1 | 1.78 | AliExpress | https://www.aliexpress.us/item/3256806809940624.html | search result |
| 16 | Compression springs, 0.5 mm wire, stainless, 10-20 pieces (choose 6 mm OD, 15-20 mm long) | Light spring that presses the magnet up against the underside of the board top | 1 | 4.07 | AliExpress | https://www.aliexpress.us/item/2251832816359883.html | search result |
| 17 | PTFE high-temperature adhesive tape, 0.13 mm thick, 25 mm wide, 10 m | Low-friction face on the magnet so it slides against the underside of the top | 1 | 3.91 | AliExpress | https://www.aliexpress.com/i/2251832735185205.html | search result |

## Notes per row

1. **Arduino Uno R3 compatible board (ATmega328P, CH340 USB), with USB cable**: Search result showed $3.10 regular price ($0.99 was a new-shopper deal). The listing has variants (a proto shield is sold on it too), so pick the 'UNO R3 CH340 + cable' option; that variant may cost a little more. CH340 boards need the CH340 USB driver on some computers. Fallback: the eBay kit in the notes ($21.35 for Uno + shield + 4 A4988, US seller, free shipping) replaces this row and the next one.
2. **CNC Shield V3 with 4x A4988 stepper drivers (heatsinks included)**: I saw this listing (shield + 4 A4988/DRV8825 option) in search results, but no price for it. $6 is my estimate from typical AliExpress shield and A4988 prices. Choose the A4988 option, not DRV8825. Only 2 of the 4 drivers are used; the other 2 are spares. Fit 3 jumpers under each driver for 1/16 microstepping.
3. **STEPPERONLINE NEMA 17 stepper 17HS15-1504S-X1 (45 N·cm, 1.5 A, 42x42x39 mm, 5 mm D-shaft, 1 m cable)**: $10.50 each; the listing sells 1-5 motors. The search summary said free shipping was offered, but I could not confirm it. Specs from the search result: 45 N·cm, 1.5 A/phase, 5 mm shaft, 4 wires, so it meets the >= 40 N·cm, about 1.5 A spec. Alternative: the same motor from omc-stepperonline.com at $9.13 each (search result) plus shipping from their US warehouse, which I could not see: https://www.omc-stepperonline.com/nema-17-bipolar-45ncm-63-74oz-in-1-5a-42x42x39mm-4-wires-w-1m-pin-connector-17hs15-1504s-x1
4. **GT2 6 mm belt 5 m + 8x GT2 20-tooth pulleys (5 mm bore) + 8 tensioner springs (SIBOOR kit)**: $7.21 with free shipping, per the search result. The two axes need about 2.1-2.3 m of belt in total, so 5 m leaves plenty spare. 2 of the 8 pulleys go on the motors; the rest are spares. Idlers are not included (next row).
5. **GT2 20-tooth idler pulley with bearings, 3 mm bore, 6 mm belt**: $0.99 for 1 piece, per the search result. The listing also sells 16T and 5 mm bore versions; pick 20T, 3 mm bore, 6 mm width. Each one runs on an M3 bolt (already owned).
6. **8 mm x 500 mm hardened chrome linear shaft, pack of 4**: The indexed page title read '25.03US $ 20% OFF | 4pcs ... 8mm linear shaft L 500mm hardened Chrome', and the URL slug said free shipping. This is an older listing, so check it is still live. Backup: the per-rod listing https://www.aliexpress.us/item/3256803516623926.html (8 mm, 100-500 mm lengths). I could not see the price of its 500 mm option ($2.39 was the lowest variant). This is the most expensive row and the best place to save if a cheaper 500 mm rod is listed.
7. **LM8UU linear ball bearing 8x15x24 mm, 10 pieces**: The page title read '6.7US $ 10% OFF | LM8UU bearing 8*15*24(mm) 10pieces'. The design needs 8 (4 on the gantry, up to 4 on the carriage), so 2 are spare. The old BOM said 12, but 10 is enough.
8. **12 V holding electromagnet P20/15 (20 mm x 15 mm, M3 thread in back, about 0.25 A)**: $2.07 regular price, shown with 'import charges included' ($1.26 was a new-shopper deal). The listing sells 5/6/12/24 V versions; pick DC 12V. The listing rates it at 3 kg / 30 N. Buying a second one as a spare would add about $2.
9. **MOSFET trigger switch module, 15 A 400 W (dual AOD4184A, 'D4184'), DC 5-36 V**: $0.84 regular ($0.77 on sale), per the search result. Listings for this module give the trigger range as DC 3.3-20 V, so the Arduino's 5 V turns it fully on. It has VIN+/VIN- power input, OUT+/OUT- to the magnet, and TRIG/PWM + GND for the signal. Buying a few spares would cost about $1-2 more.
10. **1N5819 Schottky diode, 1 A 40 V, DO-41, 100 pieces**: $1.76 for 100, per the search result. Only 1 is needed; the pack is the cheapest way to buy it. This is the 'passives' row.
11. **Mechanical endstop switch board with cable (RAMPS style), 6 pieces**: $4.63 (down from $5.72), per the search result. A 3-piece set for $3.07 also showed up, but without a link I could use. Wire only the signal and GND leads to the shield's X-/Y- pins. These boards have an LED and some are wired so the switch is closed when not pressed, so check the logic with GRBL's $5 setting (invert limit pins) and test before homing.
12. **12 V 5 A (60 W) AC/DC adapter, US plug, 100-240 V input**: $9.71, per the search result. The listing has plug and voltage options; pick US plug, 12 V 5 A. It is an enclosed brick, so there is no mains wiring: cut off the barrel plug, or add a $1 female DC-jack-to-screw-terminal adapter, and run the leads to the fuse. Cheap adapters are not UL listed. A US-stock option is Amazon 'Waysse 12V 5A' at about $9.99 (search result, 'offers starting from'), plus shipping without Prime: https://www.amazon.com/Converter-100-220V-Transformer-5-5x2-1mm-Accessories/dp/B08C594VNP
13. **Inline blade fuse holder, 18 AWG, waterproof, with 5 A blade fuse**: $0.80 regular ($0.62 on sale), per the search result. The listing sells fuse ratings from 1 A to 40 A; pick the 18 AWG holder with a 5 A fuse. This replaces the old BOM's 5x20 mm glass fuse holder, since blade holders are cheaper and easier to find.
14. **M8 flat washer, GB97/DIN125, black grade 8.8 carbon steel (8.4 x 16 x 1.6 mm), 50 pieces**: The search result only showed $1.09 for 5 pieces of an unknown size ($2.95 regular). $4 for 50 x M8 is my estimate. The washers MUST be plain carbon steel (zinc-plated or black). Stainless steel (304/A2) washers are barely magnetic and will not work, and many 'M8 washer' listings are stainless.
15. **Self-adhesive felt furniture pad roll, 1 m**: $1.78 regular ($0.99 new-shopper deal), per the search result. I could not see the strip widths; pick one 20 mm wide or wider (34 discs need about 0.7 m of 20 mm strip), and note wider strips may cost more. Alternative: a cuttable self-adhesive felt sheet, https://www.aliexpress.us/item/3256802943067750.html, $4.56 regular (search result).
16. **Compression springs, 0.5 mm wire, stainless, 10-20 pieces (choose 6 mm OD, 15-20 mm long)**: $4.07 (3% off $4.20), per the search result. The listing comes in 3-12 mm OD and 5-50 mm lengths. 0.5 mm wire makes a light spring, which is what the design wants. A stainless spring is fine here because it is not what the magnet grabs. A $0 option is the spring from a retractable ballpoint pen (about 5-6 mm OD).
17. **PTFE high-temperature adhesive tape, 0.13 mm thick, 25 mm wide, 10 m**: $3.91 regular ($0.99 new-shopper deal), per the search result. The title says it is the PTFE-coated fiberglass cloth type, which is a little rougher than pure PTFE film but fine for this. Plumber's thread-seal tape is not adhesive, so don't substitute it.

## Tax and shipping estimate

This is an estimate; none of it was seen at checkout. (1) Sales tax: AliExpress and eBay collect state sales tax for US buyers in most states. 7.5% of the $106.57 parts subtotal is about $8.00. Buyers in states with no sales tax (OR, MT, NH, DE, AK) pay about $0. (2) Shipping: about $6 for AliExpress. Search results showed free shipping on the GT2 kit and the 4-rod pack, but at least one similar non-Choice listing (LM8UU) showed $3.23 shipping. This order spreads over about 12 AliExpress sellers, and Choice items combine to ship free while other sellers may each charge. The eBay motors are assumed to ship free (the search summary said so; I could not confirm it), and the fallback eBay Uno kit says free USA shipping. (3) Import duty: since August 2025 there is no duty-free de minimis for US parcels. Several AliExpress US listings showed 'import charges included' in their search results (the electromagnet, the Uno, the per-rod shaft), so I did not add separate duty. If some sellers bill duty at checkout or the carrier bills it on delivery, add a few dollars. Estimated total: $106.57 parts + about $14 = about $120.57, which is about $21 over the $100 limit.

## Already owned (not bought)

- 3D printer access and about 250-300 g of PLA (34 pieces plus rod holders, gantry end blocks, magnet carriage, motor/idler/endstop mounts, belt clamps)
- Plywood or MDF base, about 600 x 500 mm
- 3 mm hardboard or MDF sheet for the board top, plus wood strips for the perimeter frame that holds it
- M3 screws and nuts (motor mounts, idler axles, magnet mount into its M3 thread, printed parts) and wood screws
- Hookup wire (18-22 AWG) and a few zip ties
- Soldering iron and solder
- Superglue or epoxy for gluing the washers into the piece bases
- Multimeter (to set each A4988's current limit / Vref)
- USB cable (one also comes with the Uno listing) and a computer or Raspberry Pi
- Paper and a printer for the board sheet (cad/board-sheet.svg)
- Optional: a switched power strip as the on/off switch for the 12 V adapter

## Researcher's notes

I could not get the whole order under $100. The cheapest honest list I could build is $106.57 in parts plus about $14 in tax and shipping, about $120.57 in total, roughly $21 over the limit. It is mostly AliExpress, with the motors from STEPPERONLINE's eBay store.

How the prices were checked: WebFetch was blocked by the network egress proxy for every vendor site I tried (zyltech.com, omc-stepperonline.com, amazon.com, tindie.com, adafruit.com). So I never saw a price on a product page. Every price comes from search results, either the indexed page title or the search tool's summary of the listing, and is marked 'search result'. Two rows are estimates with no price seen at all: the CNC shield + A4988 drivers ($6) and the M8 washers ($4).

AliExpress caveats: many listings have variants, and a search-result price may be for a different variant than the one needed (size, length, voltage, pack size). Where a new-shopper deal and a regular price both appeared, I used the regular price. Some listings found are older, notably the 4-rod pack (32420848964), so check that each link is still live before typing it into the form.

Ways to close the $21 gap (none are guaranteed):
1. Rods, the biggest row at $25.03: a per-rod listing whose 500 mm option is $4.50 or less saves about $7.
2. A new AliExpress account usually gets a few $0.99 welcome-deal items plus store coupons such as $2-3 off $15. On the Uno, magnet, felt and PTFE tape that could save about $5-10, but it is not dependable.
3. Use a ballpoint-pen spring instead of buying springs: saves $4.07.
4. If the omc-stepperonline.com US warehouse charges under about $2.70 to ship two motors at $9.13 each, buying there beats eBay.

US-stock sources cost clearly more. Prices seen in search results: 8 mm x 500 mm rods about $16.61 each on eBay, an LM8UU 10-pack $12.99, a 12 V 5 A adapter $16-20 on eBay, and an Uno + CNC shield + 4 A4988 kit $21.35 on eBay (https://www.ebay.com/itm/292161403451, Albers LLC, free USA shipping; its description lists UNO + CNC Shield V3 + 4 A4988 with heatsinks). That kit is the safest swap for rows 1-2 if the AliExpress Uno or shield turns out more expensive than estimated; it adds about $12.

Spec checks:
- The motor (17HS15-1504S-X1) is 45 N·cm, 1.5 A, with a 5 mm shaft.
- The pulleys are 20T with a 5 mm bore; the idlers are 20T with a 3 mm bore and bearings.
- The bearings are LM8UU, 8x15x24 mm. The design needs 8, so the 10-pack is enough; the old BOM said 12.
- The magnet is the 12 V P20/15 variant.
- The MOSFET module is the dual AOD4184A 'D4184' board. Its listings give a 3.3-20 V trigger range, so the 5 V from A3 switches it fully on.
- The power supply is an enclosed 12 V 5 A adapter, so there is no mains wiring.
- The washers must be carbon steel, not stainless.

Two changes from docs/BOM.md: a blade fuse holder replaces the 5x20 mm glass-fuse holder, and the felt is a 1 m roll instead of a sheet.

The shield + drivers row needs only 2 of its 4 A4988s, and the GT2 kit leaves 6 spare pulleys.
