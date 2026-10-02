# Handoff: after the design push

The warm-up submission closes **Sunday, October 4 at 11:59 PM**.

## Where things stand (2026-10-01)

The design push is done. The saved workflow
([`.claude/workflows/robotic-chessboard-design-push.js`](../.claude/workflows/robotic-chessboard-design-push.js))
ran all five tracks, each with an independent review and a fix pass:

| Track | Result |
|---|---|
| Gantry and assembly CAD | [cad/](../cad): 16 printed parts, STLs, assembly with fit and reach checks, four renders. `bash cad/export.sh` passes all 11 checks |
| Wiring schematic | [img/wiring.svg](img/wiring.svg), drawn by `cad/make-wiring.js` |
| Engineering calculations | [CALCULATIONS.md](CALCULATIONS.md), every figure printed by `scripts/calculations.js` |
| G-code sender and calibration | `send.js`, `calibrate.js`, `src/grbl.js`, `src/send-job.js`, `src/calibration.js`; 70 tests pass |
| Parts list | [BOM.md](BOM.md): every row checked on 2026-10-01; **$116.38 with tax, $16.38 over the $100 budget** |

## Open before submitting

1. **Budget.** Pick changes from
   [BOM.md: Getting under $100](BOM.md#getting-under-100). Change (a) also
   needs the idler holes in the CAD changed from 3 to 5 mm.
2. **Prices that can move.** Row 7 (bearings) is on sale until Oct 7, row 13
   (fuse holders) is on sale with no end date shown, and the eBay motor (row
   3) showed "Last one".
3. **Quantities.** Rows 11 and 14 buy more than one of an AliExpress item;
   the regular price for a second unit wasn't tried in a cart.

## Notes

- AliExpress blocks automated visits to its product pages, but its search
  results load. Prices were read from the search page's quick-view panel with
  the variant selected.
- The washers must be plain carbon steel. Stainless washers are barely
  magnetic.
- Sales tax in San Jose is 10.000% since 2026-04-01 (Measure A).
