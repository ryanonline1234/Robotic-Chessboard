# Handoff: after the design push

The warm-up submission closes **Sunday, October 4 at 11:59 PM**.

## Where things stand (2026-10-01)

The design push is done. The saved workflow
([`.claude/workflows/robotic-chessboard-design-push.js`](../.claude/workflows/robotic-chessboard-design-push.js))
ran all five tracks, each with an independent review and a fix pass:

| Track | Result |
|---|---|
| Gantry and assembly CAD | [cad/](../cad): 16 printed parts, STLs, assembly with fit and reach checks, four renders. `bash cad/export.sh` passes all its checks |
| Wiring schematic | [img/wiring.svg](img/wiring.svg), drawn by `cad/make-wiring.js` |
| Engineering calculations | [CALCULATIONS.md](CALCULATIONS.md), every figure printed by `scripts/calculations.js` |
| G-code sender and calibration | `send.js`, `calibrate.js`, `src/grbl.js`, `src/send-job.js`, `src/calibration.js` |
| Parts list | [BOM.md](BOM.md): every row checked on 2026-10-01 |

The full-spec parts list came to $116.38, so four parts were cut to fit the
$100 tier: the separate 3 mm idlers (the belt kit's 5 mm idlers are used,
and the CAD's idler bore is now a setting), the felt pads, the 5 A adapter
(3 A instead) and the second 45 N·cm motor (a 17HS4401 on X instead). **The
funded list is $98.36 with tax.** The cut parts, plus spares and other
improvements, are in [BOM.md: Add back when building](BOM.md#add-back-when-building),
to be bought separately at build time.

## Open before ordering

1. **Prices that can move** ([BOM.md](BOM.md#prices-that-can-change)): the
   X motor (row 3) and the bearings (row 6) are on sale until Oct 7; the
   fuse holders (row 12) are on sale with no end date shown.
2. **Quantities.** Rows 10 and 13 buy more than one of an AliExpress item;
   the regular price for a second unit wasn't tried in a cart.
3. **Belt kit idlers.** Row 5's two idlers come from the kit's description.
   If they don't arrive, buy the 3 mm idler pack (an add-back) and print the
   two idler parts for 3 mm ([cad/README.md](../cad/README.md#using-3-mm-idlers)).

## Notes

- AliExpress blocks automated visits to its product pages, but its search
  results load. Prices were read from the search page's quick-view panel with
  the variant selected. After many quick-views it starts showing a CAPTCHA.
- The washers must be plain carbon steel. Stainless washers are barely
  magnetic.
- Sales tax in San Jose is 10.000% since 2026-04-01 (Measure A).
