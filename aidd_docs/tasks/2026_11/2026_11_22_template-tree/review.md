# Review: template heading tree and aidd-dev contracts

## Round 1

- Diff: `2d90673f4...729c4a45a` and `26ee09948...184747b92`
- Uncommitted changes: no
- Axes: code, relevancy
- Verdict: approve, because no critical or major defect; four minor items remain

### Criteria

- [x] Doc and template trees hold every heading level outside fences and comments — `scripts/check/engine/ops.cjs:300-330`
- [x] Unknown, reordered, missing children and a second title each named once — probed: `#### Deep` under a round, `### Findings` before `### Limits`, `## Rond 2`, a second `#`
- [x] Replay diff recorded, +7 findings in 4 files, all real (`### 1)` without backticks, no `###` task headings, `### Out of scope`) — replay/phase-after.txt
- [x] Review and assert contracts pass filled and fail raw — `scripts/__tests__/check/dev-contracts.test.js:12-40`
- [x] Audit template carries the report only — `plugins/aidd-dev/skills/04-audit/assets/audit-template.md:1`
- Unverified at runtime: the turn-end hook on a broken review.md — the hook test not run here

### Assumptions

- Slot matching `.+` is greedy and a wrong-level heading is reported as unknown plus missing — holds, noisy but accurate, checked at `scripts/check/engine/ops.cjs:157-180`
- Per-pillar audit files also carry Top actions and Coverage — holds by the template ("both run modes fill"), limit for the skill text

### Findings

- `scripts/check/engine/ops.cjs:172` : a missing repeating heading prints the raw template name, `heading "`{{number}})` {{name}}" missing under "Tasks to do"`, proof replay/phase-after.txt (phase-1.md:46) → word a slot name as a shape, for example `heading shaped like "…"`, or drop the quotes around slot names — 🟢 minor
- `plugins/aidd-dev/skills/03-assert/actions/01-assert.md:28` : the line stops at "fix each finding"; `plugins/aidd-pm/skills/02-user-stories/actions/07-finalize.md:21` also says to validate again and to stop after 3 passes, and 05-review's own step 4 says "repeat until it matches", proof both files → add "then validate again" to the assert line and the audit transversal line — 🟢 minor
- `plugins/aidd-dev/skills/05-review/SKILL.md` Transversal rules : "Read only: never run the app or its checks" now sits beside an action that runs a script, proof `actions/03-conclude.md:18` → name the validate script as the one allowed run in the rule, or accept the literal reading as covering project checks only — 🟢 minor
- `scripts/__tests__/artifact-hook.test.js:364` : the slack `files + 120` is a bare number while the comment says it grows with globs, proof aidd-dev has 5 scope globs over 14 folders → derive it from the glob count (`globs * folders + margin`) or leave 120 with the 5×14 sum in the comment; the redundant folder stats in the hook are not worth touching — 🟢 minor

### Limits

- A second `#` heading does not reset the open stack, so body lines after it join the last child heading; matters only for a table header under a duplicate title — a test with a table after a second `#` would settle it
- `optional` ambiguity (a bare name shared by two parents omits both) has no test in the diff — a template with `Notes` under two parents would show it
- Audit contract has no real sample in the repo — rests on the filled template alone, as the plan says
