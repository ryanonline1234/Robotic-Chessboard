# Handoff: design push for the funding submission

The warm-up submission closes **Sunday, October 4 at 11:59 PM**. This is the
remaining design work, ready to run from a new Claude Code session.

## Where things stand

Done and pushed: the planner, simulator, tests, `docs/DESIGN.md`,
`docs/BOM.md` (estimated prices), `ROADMAP.md`, the board sheet and layout
drawing, and the piece models.

Paused partway (the workflow was stopped on 2026-10-01 before it changed any
files):

| Track | State |
|---|---|
| Parts list with real vendors and links | First research pass saved in [bom-draft.md](bom-draft.md): about $120 with tax and shipping, $21 over budget, no price confirmed on a product page |
| Gantry and assembly CAD | Not started |
| Wiring schematic | Not started |
| Engineering calculations | Not started |
| G-code sender and calibration software | Not started |

The whole job is saved as a workflow in
[`.claude/workflows/robotic-chessboard-design-push.js`](../.claude/workflows/robotic-chessboard-design-push.js).
It runs the five tracks in parallel, and each track gets an independent review
and a fix pass. The parts track starts from `bom-draft.md` instead of starting
over.

## The prompt

Start a Claude Code session on `ryanonline1234/Robotic-Chessboard` and paste:

```text
Run the saved workflow robotic-chessboard-design-push from .claude/workflows/,
passing args {"repo": "<absolute path of this repo's clone>"}. Read
docs/HANDOFF.md first for context.

When it finishes:
1. Read every track's build, review and fix results, and check the files they
   produced yourself (run npm test, run bash cad/export.sh, look at the renders
   in docs/img/).
2. Replace docs/BOM.md with the finished parts list: only rows the verifiers
   confirmed or corrected, a tax and shipping line, and the total. Mark any row
   that is still unconfirmed. Then delete docs/bom-draft.md.
3. Update docs/DESIGN.md to link the new CAD files, renders, schematic and
   docs/CALCULATIONS.md, and to use the GRBL settings the calculations
   recommend. Update the README status table and repo map, and tick off the
   ROADMAP items that are now done.
4. Commit and push to main.
5. Give me the parts list as rows for the funding form (part, what it's for,
   qty, unit price, vendor, link), then the tax and shipping figure and the
   total against the $100 tier 3 budget.
```

If the session has no Workflow tool, swap the first paragraph for:

```text
Read docs/HANDOFF.md and .claude/workflows/robotic-chessboard-design-push.js.
Do each of the five tracks in that file yourself, one at a time, following the
task text in its prompts: build, then review your own work critically, then
fix. Start with the parts list and the gantry CAD.
```

## Notes for the next session

- Vendor websites blocked page fetches during research, so prices came from
  search results. The form needs a real vendor and price per row, so expect
  some rows to need checking by hand in a browser.
- Rows that matter most for the budget: the 8 mm rods ($25, the biggest), the
  CNC shield and the washers (both estimates).
- The washers must be plain carbon steel. Stainless washers are barely
  magnetic.
