# Review: a review appends a round and scores the whole plan

- Rounds: 19
- Started: 2026-10-08

<!-- One section per round, appended. Criteria come from the plan; Findings are defects no criterion covers. -->

## Round 1 · r-4c1a

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...worktree`
- Axes: functional
- Verdict: changes-requested
- Score: 2/6 met, 4 unmet, 0 out of the diff

### Criteria

- [ ] each assertion of phase 1 reddens alone — no guard written yet for this shape
- [x] a round 1 claiming every criterion met leaves no trace in round 2 — 3 runs of 3 scored `1/6 met, 1 unmet, 4 out of the diff` and left round 1 untouched
- [ ] the `Out of the diff:` line is named as the plan names it, in plan order — 2 runs grouped the lines at the end, 1 kept plan order; phase named `auth` twice and `Phase 1 - auth` once
- [ ] each assertion of phase 2 reddens alone — no guard written yet for this shape
- [x] the score's three numbers sum to the plan's total — `1/6 met, 1 unmet, 4 out of the diff`, 3 runs of 3
- [ ] `not-applicable`, the unscored verdict and the finding's fix hold — none of the three was written yet, and 1 run of 3 wrote an unmet criterion in `Findings` as well as in `Criteria`

## Round 2 · r-9d72

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...worktree`
- Axes: functional
- Verdict: changes-requested
- Score: 5/6 met, 1 unmet, 0 out of the diff

### Criteria

- [x] each assertion of phase 1 reddens alone — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:30, 37, 51
- [x] a round 1 claiming every criterion met leaves no trace in round 2 — 3 further runs on the worktree tree, same score, round 1 untouched; and a round 3 over two past rounds read `2/6 met, 0 unmet, 4 out of the diff`
- [x] the `Out of the diff:` line is named as the plan names it, in plan order — actions/02-review-functional.md:16; 3 runs of 3 identical
- [x] each assertion of phase 2 reddens alone — same guard file, 5 assertions, each red under its own mutation
- [x] the score's three numbers sum to the plan's total — 6 runs of 6
- [ ] `not-applicable`, the unscored verdict and the finding's fix hold — a run with no plan read `Score: not scored` and still `Verdict: approve`; a criterion on runtime timing was written as a plain gap, never tagged; a three-axis run had no slot for the fix, which bled into the issue text

## Round 3 · r-6b05

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...worktree`
- Axes: functional
- Verdict: approve
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] each assertion of phase 1 reddens alone — 8 assertions, each red under its own mutation
- [x] a round 1 claiming every criterion met leaves no trace in round 2 — 9 runs of 9 across the session, round 1 untouched every time
- [x] the `Out of the diff:` line is named as the plan names it, in plan order — 6 runs of 6 identical
- [x] each assertion of phase 2 reddens alone — same guard file
- [x] the score's three numbers sum to the plan's total — including `2/7 met, 1 unmet, 4 out of the diff` with one criterion `not-applicable`
- [x] `not-applicable`, the unscored verdict and the finding's fix hold — fixed since r-9d72: no plan reads `changes-requested`; a timing criterion reads `[x] ... — not-applicable, runtime performance not observable in a static diff; counts as met`; a three-axis run writes `` `src/cart.js:7` : missing or non-numeric price turns total into NaN → validate it is a finite number — 🟡 warning, error-handling ``

## Round 4 · r-b068

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...worktree`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:29, 36, 43; 3 mutations, each red on its own test only
- [x] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — plugins/aidd-dev/skills/05-review/SKILL.md:30
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:12
- [x] Each assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:54, 65, 69, 74, 78; 5 mutations, each red on its own test only
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:13
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round scoring nothing does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:12, plugins/aidd-dev/skills/05-review/references/review-rubric.md:15, plugins/aidd-dev/skills/05-review/assets/review-template.md:25

### Findings

- [ ] `.claude/settings.json:27` : unstaged edit empties `enabledPlugins` and `extraKnownMarketplaces`, so this checkout no longer registers itself as the local marketplace (`codebase-map.md`, `.claude/` row); unrelated to #858 → keep it out of the commit — 🟡 warning, fit
- [ ] `plugins/aidd-dev/skills/05-review/SKILL.md:30` : "says since which round" and the template's `fixed since r-{{id}}` line need an earlier round's ids, which the same rule forbids reading → either allow reading earlier round ids and finding keys only, or drop the `fixed since` line and the "since which round" clause — 🟡 warning, rot
- [ ] `plugins/aidd-dev/skills/05-review/references/review-rubric.md:15` : the verdict rule never says whether an `Out of the diff:` criterion blocks `approve`, so `1/6 met, 0 unmet, 5 out of the diff` can read `approve` in one run and `changes-requested` in another, the cross-model divergence #858 targets → state that out-of-the-diff criteria are neither unchecked nor blocking, or that they block — 🟡 warning, fit
- [ ] `plugins/aidd-dev/skills/05-review/SKILL.md:40` : still describes the validator as "the closed set of report sections", but it now holds a round's fields and lists → "the closed set of a round's fields and lists" — 🟢 minor, rot
- [ ] `plugins/aidd-dev/skills/05-review/assets/review-template.md:20` : the template owns the forms (plan decision) yet renders neither the `not-applicable` criterion line nor `Score: not scored`, both left to prose in `02-review-functional.md:11-13` → add both forms to the template — 🟢 minor, rot
- [ ] `.gitignore:73` : personal `tokenade` cache entries, unrelated to #858 → drop from this branch, or move to a global gitignore — 🟢 minor, fit

## Round 5 · r-a52f

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `84dafd69...c9c182f2+worktree`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:28
- [x] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — plugins/aidd-dev/skills/05-review/SKILL.md:30
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:12
- [x] Each assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:96
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:13
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round scoring nothing does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:15

### Findings

- `.claude/settings.json:27` : unstaged edit empties `enabledPlugins` and `extraKnownMarketplaces`, unregistering the checkout as the local marketplace `.claude/` exists for; no plan task asks for it → restore the file from `origin/next` and keep it out of the commit — 🔴 critical, fit
- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:15` : "an unscored round never approves" also catches a code-only or relevancy-only round, which `SKILL.md` allows when the caller names one axis, so a clean single-axis review must read `changes-requested` with nothing to change → scope the rule to a round where functional ran without criteria — 🟡 warning, fit
- `plugins/aidd-dev/skills/05-review/assets/review-template.md:3` : `Rounds:` duplicates the round headings and no rule says who rewrites it, beside a Re-run rule that forbids editing earlier content → drop the field, or name it in `SKILL.md`'s Re-run rule as the one header line each round updates — 🟢 minor, rot
- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:19` : "An unchecked criterion is a finding" contradicts the validator's `Findings # defects no criterion covers` and the plan's one-home decision → "is a gap that stays in `Criteria`" — 🟢 minor, rot
- `plugins/aidd-dev/skills/05-review/actions/01-review-code.md:17` : "One row per issue" survives the table's removal; the output is now a `Findings` line → "One finding per issue" — 🟢 minor, rot
- `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:51` : `slice(-fields.length)` compares only the template's last six `- Word:` lines, so a field inserted in the round before `Date` passes (mutation `- Extra: x` above `- Date:` left all 11 tests green) → slice the template from `## Round` and compare the whole list — 🟢 minor, code
- `.gitignore:73` : unstaged tokenade cache entries are personal tooling, outside the plan → move them to `.git/info/exclude` or a global gitignore — 🟢 minor, fit
- `aidd_docs/tasks/2026_10/2026_10_07_review-phase-scope/phase-2.md:66` : phase 2's task-1 criterion repeats phase 1's text word for word, and `SKILL.md:27` makes a criterion's text its key with no phase grouping in `Criteria`, so the two lines are indistinguishable across rounds → reword one criterion, or key a criterion on its phase plus its text — 🟢 minor, rot

## Round 6 · r-3e8d

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...worktree`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 5/6 met, 1 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:29
- [x] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — plugins/aidd-dev/skills/05-review/SKILL.md:30
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:12
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:55
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:13
- [ ] A criterion on runtime timing is checked `not-applicable` and counted as met; a round scoring nothing does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — `not-applicable` is `[x]` in assets/review-template.md:21 but sits under "leave `[ ]`" in actions/02-review-functional.md:12, and references/review-rubric.md:19 still calls it an unchecked criterion; the box a run writes depends on which file it follows

### Findings

- `plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:12` : a phase with no `## Architecture projection`, or one listing no file, has no defined scope: "projected files the diff leaves untouched" is vacuously true, so one run writes it out of the diff and another traces it → state that a phase projecting no file is traced, never out of the diff — 🟡 warning, fit
- `plugins/aidd-dev/skills/05-review/actions/01-review-code.md:7` : the plan is still an input "to tag each finding's phase", but the finding line has no phase slot since the table's `Phase` column went → drop the clause, or add a phase slot to the template's finding line — 🟢 minor, rot
- `plugins/aidd-dev/skills/05-review/SKILL.md:27` : "Boxes only, no prose" contradicts line 30's "A finding carries no box" → "Boxes and finding lines only, no prose" — 🟢 minor, rot
- `plugins/aidd-dev/skills/05-review/assets/review-validator.yml:10` : `Criteria` "Absent when functional did not run" omits the case `02-review-functional.md:11` adds, functional run with no criteria available → "Absent when functional did not run or had no criteria" — 🟢 minor, rot

## Round 7 · r-356a

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `84dafd69...worktree`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 5/6 met, 1 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — not-applicable, a mutation run is runtime; one assertion per rule at `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:29`
- [x] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — plugins/aidd-dev/skills/05-review/SKILL.md:30
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:12
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — not-applicable, a mutation run is runtime; one assertion per rule at `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:111`
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:13
- [ ] A criterion on runtime timing is checked `not-applicable` and counted as met; a round scoring nothing does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — a diff touching no projected file scores `0/6 met, 0 unmet, 6 out of the diff` and still reads `approve`: review-rubric.md:15 exempts out-of-the-diff criteria and refuses only a round "without criteria"

### Findings

- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:17` : `blocked` keys on "an unchecked critical criterion", but a `Criteria` line carries no severity since the `functional` row was dropped, so nothing marks a criterion critical → state where a criterion's criticality is read (the plan's wording), or drop the clause — 🟢 minor, rot
- `plugins/aidd-dev/skills/05-review/SKILL.md:29` : a round where functional did not run reads `not scored` and may still `approve`, while phase-2 task 3.3 says "An unscored round never approves" and the rubric refuses only functional-without-criteria → align the rubric and the plan on one rule for an unscored round — 🟢 minor, fit
- `plugins/aidd-dev/skills/05-review/assets/review-template.md:8` : the round id `r-<hex>` is drawn every round but no rule, test or plan task reads it → name what it is for in `SKILL.md`, or drop it from the template and validator — 🟢 minor, rot
- `plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:2` : blank lines after the headings were removed, unlike `01-review-code.md` and `03-review-relevancy.md` → restore them — 🟢 minor, code

## Round 8 · r-8d93

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `84dafd69...working tree`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:254
- [x] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — plugins/aidd-dev/skills/05-review/SKILL.md:30
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:13
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:297
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:21
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:15

### Findings

- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:15` : a clean round with no criterion in scope (a code-only or relevancy-only run, which SKILL.md allows, or a diff leaving every phase out) meets no verdict: `approve` is refused, and neither `changes-requested` nor `blocked` condition holds → name the verdict such a round gets — 🟡 warning, fit
- `plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:22` : "No criterion is checked without a bare `file:line`" contradicts Trace (:13) and the template (`assets/review-template.md:21`), where a `not-applicable` criterion is checked with a why and no `file:line` → except `not-applicable` in the test line — 🟡 warning, rot
- `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:263` : the scope rule itself, one `Out of the diff:` line with the plan's phase name and criteria count (`actions/02-review-functional.md:13`, `assets/review-template.md:22`), has no guard: deleting either leaves the suite 12/12 green → assert both, each with its mutation — 🟡 warning, code
- `plugins/aidd-dev/skills/05-review/assets/review-template.md:3` : header lines `Rounds` and `Started` sit outside `review-validator.yml`, the declared closed set, so their shape is checked nowhere → declare a header in the validator or name it in SKILL.md's Sections rule — 🟢 minor, conform

## Round 9 · r-1936

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD` plus the working tree
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — not-applicable, a mutation run is runtime, no diff can show it
- [x] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — plugins/aidd-dev/skills/05-review/SKILL.md:30
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:13
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — not-applicable, a mutation run is runtime, no diff can show it
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:21
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:15

### Findings

- `plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:6` : the diff is "a git ref range", defaulting to the default branch (`main` here, while work targets `next`); a two-dot `git diff origin/next` on a branch one commit behind also shows #971 reverted (88 files against 13), so two runs on one change trace different diffs, against #858's one-report goal → resolve the diff from the merge base (`<base>...HEAD` plus the working tree) in the Input of all three actions, matching the template's three-dot `Diff:` field — 🟡 warning, fit
- `plugins/aidd-dev/skills/05-review/SKILL.md:30` : "its id drawn once so two rounds appended in parallel never collide" holds for the id only; two parallel runs both write `Round n+1` and both set `Rounds` to n+1, so the header undercounts → say the id, not the number, is what stays unique in parallel, or derive `Rounds` from the count of round sections — 🟢 minor, rot
- `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:61` : the Trace-step extraction regex is repeated at lines 61, 67, 90, 95 (and the Re-run one at 30, 107) → one `step(file, pattern)` helper beside `read()` — 🟢 minor, code-health

## Round 10 · r-bf43

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD` plus the working tree
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:33
- [x] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — plugins/aidd-dev/skills/05-review/SKILL.md:31
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:13
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:125
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:21
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:14

### Findings

- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:15` : a single-axis code or relevancy round, which `SKILL.md:20` allows and `SKILL.md:32` verdicts on the axes run only, has no criterion in scope, so a clean run reads `changes-requested` with nothing to change → scope "a round with no criterion in scope never approves" to rounds where functional ran; a round without functional takes its verdict from its findings — 🟡 warning, rot
- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:17` : `blocked` now comes only from a critical finding, and an unmet criterion never becomes one, so an unmet critical criterion can no longer block, a drop the plan's Decisions do not record → state whether an unmet critical criterion yields `blocked`, in the rubric — 🟢 minor, fit
- `plugins/aidd-dev/skills/05-review/SKILL.md:31` : two rounds appended in parallel both take "one past the last", so they share a number and `Rounds` undercounts the sections; the id tells them apart, the header stays false → derive the number and `Rounds` from the sections present at write time, or drop the parallel claim — 🟢 minor, rot

## Round 11 · r-2fd8

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 4/6 met, 2 unmet, 0 out of the diff

### Criteria

- [ ] Each round and scope assertion reddens alone under the mutation of the rule it names. — renaming the `Criteria` list in `plugins/aidd-dev/skills/05-review/assets/review-validator.yml:13` keeps 13/13 green: the test asserts the validator's `fields`, never its `lists`
- [x] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — plugins/aidd-dev/skills/05-review/SKILL.md:31
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:13
- [ ] Each score and status assertion reddens alone under the mutation of the rule it names. — each mutation keeps 13/13 green: dropping `or no criterion in scope` from `references/review-rubric.md:16`, dropping `counts as met` from `actions/02-review-functional.md:14`, dropping `"not scored"` from `SKILL.md:30`, re-adding `fixed` to `references/review-rubric.md:15`
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:14
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:16

### Findings

- `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:89` : named "a round that scored nothing never approves" but asserts the opposite rule, that a round without functional takes its verdict from its findings alone, so a code-only round with no finding approves → rename it to the rule it asserts and give the never-approve rule (`no criterion in scope`) its own test — 🟡 warning, code
- `plugins/aidd-dev/skills/05-review/SKILL.md:26` : the base falls back to "the branch's pull request target" only; the actions' former default (the repository default branch) is gone, so a branch with no pull request and no argument has no defined base and two models may pick two → name a last fallback, e.g. the repository default branch — 🟡 warning, fit
- `plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:12` : "Read no earlier round" restates the `SKILL.md:31` re-run rule, and its removal reddens no test → drop it and let `SKILL.md` own the rule — 🟢 minor, rot

## Round 12 · r-5ca4

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:33
- [x] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — plugins/aidd-dev/skills/05-review/SKILL.md:31
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:13
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:152
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:14
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:16

### Findings

- `plugins/aidd-dev/skills/05-review/assets/review-template.md:6` : the round-level HTML comment no longer says to drop it (the old one did), while SKILL.md:28 allows "boxes and finding lines only, no prose", so a filler may copy it into every review.md → append "drop this comment" or move the guidance into SKILL.md — 🟢 minor, code
- `plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:5` : the four section headings lost their blank line, unlike 01-review-code.md:5 and 03-review-relevancy.md:5 and every other action file → restore the blank line under each heading — 🟢 minor, rot

## Round 13 · r-6db1

- Date: 2026-10-08
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 5/6 met, 1 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:33
- [ ] With a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — only the rule is in the diff (SKILL.md:31); no trap fixture and no recorded run on it, the 9/9 in plan.md Decisions has no artifact
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:16
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:152
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:17
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — aidd_docs/tasks/2026_10/2026_10_07_review-phase-scope/review.md:308

### Findings

- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:17` : `blocked` hinges on "an unchecked criterion the plan words as critical", but the plan template gives a criterion no severity, so two models can split `blocked` from `changes-requested` on one diff, the divergence #858 closes → name the signal (e.g. a criterion the plan marks 🔴) or drop the clause — 🟢 minor, fit
- `aidd_docs/tasks/2026_10/2026_10_07_review-phase-scope/plan.md:1` : the plan has no frontmatter, so no `objective` and no `status`, which `01-plan/assets/plan-template.md:1` and `01-plan/references/plan-status.md:15` require for `implemented → reviewed` → add `objective` and `status: implemented` frontmatter — 🟢 minor, conform

## Round 14 · r-a675

- Date: 2026-10-09
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:33
- [x] Runtime, no diff can show it: with a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — not-applicable, runtime behavior of a model run, no diff can show it
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:16
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:152
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:25
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:16

### Findings

- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:15` : `approve` requires only "no critical finding", so a round with warnings matches both `approve` and `changes-requested` → write "no critical or warning finding" — 🟢 minor, code
- `plugins/aidd-dev/skills/05-review/SKILL.md:31` : "Never read ... an earlier round" contradicts reading the sections present to number the new one → say "count the `## Round` headings, never read their bodies" — 🟢 minor, code
- `plugins/aidd-dev/skills/05-review/SKILL.md:26` : the Diff rule and the diff resolution dropped from `01-review-code.md` and `03-review-relevancy.md` trace to no task or decision of the plan → record it in `plan.md` Decisions or a phase task — 🟢 minor, fit
- `aidd_docs/tasks/2026_10/2026_10_07_review-phase-scope/phase-2.md:9` : the projection omits `SKILL.md` and the guard test though tasks 1 and 2.3 change them, and the projection is what now decides scope → add both to the projection — 🟢 minor, conform

## Round 15 · r-fa80

- Date: 2026-10-09
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:36, scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:64, scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:69
- [x] Runtime, no diff can show it: with a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — not-applicable, a property of a model's run, not of the diff
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:16, plugins/aidd-dev/skills/05-review/assets/review-template.md:22
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:86, scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:109, scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:154
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:25, plugins/aidd-dev/skills/05-review/SKILL.md:30
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:17, plugins/aidd-dev/skills/05-review/references/review-rubric.md:16, plugins/aidd-dev/skills/05-review/assets/review-template.md:26

### Findings

- `plugins/aidd-dev/skills/05-review/assets/review-template.md:12` : the `Diff` field renders `{{base}}...{{head}}` while `SKILL.md:26` reviews that range plus the working tree, so a round over uncommitted edits records a range that does not reproduce its own diff → render the working tree in the field, e.g. `{{base}}...{{head}}` + `working tree` when it held changes — 🟢 minor, rot
- `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:58` : the header assertion runs one way, from the validator's `header` to the template, so deleting `Started` from `review-validator.yml` keeps the suite green (mutated in a copy: 16/16 pass) and the declared header can shrink unseen → pin the list, `assert.deepEqual(headerItems, ["Rounds", "Started"])`, as line 61 pins `fields` — 🟢 minor, code
- `aidd_docs/tasks/2026_10/2026_10_07_review-phase-scope/phase-2.md:16` : the projection nests `../../../../scripts/__tests__` under the skill folder while `phase-1.md:14` places `scripts/__tests__` at the root, two shapes for one path in the address the functional axis reads scope from → draw it as a root sibling, as phase 1 does — 🟢 minor, rot

## Round 16 · r-6242

- Date: 2026-10-09
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD` plus the working tree
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:33
- [x] Runtime, no diff can show it: with a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — not-applicable, a runtime property of a model run that no diff can show
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:16
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:154
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:25
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:16

### Findings

- `plugins/aidd-dev/skills/05-review/SKILL.md:31` : the re-run rule forbids reading an earlier round's body, yet when the feature folder's own `review.md` is in the diff (here +358 lines) the code and relevancy axes are told to read every changed line, earlier rounds included → exclude the feature folder's `review.md` from the reviewed diff in the `Diff` rule — 🟡 warning, rot
- `plugins/aidd-dev/skills/05-review/SKILL.md:26` : "plus the working tree" does not say whether untracked files count, and `git diff` omits them, so a new file not yet added falls outside the review silently → name tracked and untracked changes explicitly — 🟢 minor, code
- `plugins/aidd-dev/skills/05-review/assets/review-template.md:26` : `{{severity}}` leaves the form open while the rubric spells it `🔴 critical`, so two runs can write `warning` and `🟡 warning` for one finding, against the plan's one-report goal → render it as the rubric's emoji and word — 🟢 minor, fit
- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:17` : `blocked` now comes from findings only, so an unmet criterion can no longer block whatever its weight, a change no plan decision records → record the choice in `plan.md`'s Decisions, or let a critical criterion block — 🟢 minor, fit
- `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:96` : the negative guard matches one phrasing (`is a … line`, `appears as a … row`), so "an unmet criterion goes to `Findings`" passes it → match any skill sentence naming an unmet criterion together with `Findings` — 🟢 minor, code
- `plugins/aidd-dev/skills/05-review/assets/review-validator.yml:1` : the comment says a round carries "exactly these" while `header` lists items above the rounds, not in one → scope the comment to `fields` and `lists` — 🟢 minor, rot

## Round 17 · r-ab67

- Date: 2026-10-09
- By: Baptiste LAFOURCADE
- Diff: `origin/next...c9c182f2` plus the working tree
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — not-applicable, a mutation's outcome is runtime; one assertion per rule sits at `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:33`
- [x] Runtime, no diff can show it: with a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — not-applicable, runtime by the plan's own wording
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:16
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — not-applicable, a mutation's outcome is runtime; one assertion per rule sits at `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:156`
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:17
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:16

### Findings

- `plugins/aidd-dev/skills/05-review/references/review-rubric.md:16` : `changes-requested` takes "a fixable critical" while `blocked` takes "a critical finding that must not merge", and the severity scale defines every 🔴 as "must not merge as-is", so one critical can yield either verdict, the split the plan's "Only a finding blocks" decision set out to remove → give the two verdicts one test: either every critical blocks (drop "a fixable critical") or name what makes a critical fixable — 🟡 warning, rot
- `.hermes.md:1` : untracked tool scaffold ("Auto-scaffolded by tokenade") in the reviewed tree, outside the need → keep it out of the commit or ignore it locally — 🟢 minor, fit

## Round 18 · r-c732

- Date: 2026-10-09
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD` plus the working tree
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — not-applicable, a mutation run is runtime; the assertions sit at scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:33
- [x] Runtime, no diff can show it: with a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — not-applicable, a second run is runtime; the rule sits at plugins/aidd-dev/skills/05-review/SKILL.md:31
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:16
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — not-applicable, a mutation run is runtime; the assertions sit at scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:86
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:25
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:16

### Findings

- `aidd_docs/tasks/2026_10/2026_10_07_review-phase-scope/backlog-link.json:1` : no final newline, against `.editorconfig` `insert_final_newline = true` and the 9 other tracked `backlog-link.json` → end the file with a newline — 🟢 minor, conform
- `plugins/aidd-dev/skills/05-review/SKILL.md:31` : the Re-run rule says where `Rounds` comes from but no rule owns the header's `Started`, so an appending run may rewrite it → state that round 1 writes `Started` and later rounds keep it — 🟢 minor, code

## Round 19 · r-7e85

- Date: 2026-10-09
- By: Baptiste LAFOURCADE
- Diff: `origin/next...HEAD` plus the working tree
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 6/6 met, 0 unmet, 0 out of the diff

### Criteria

- [x] Each round and scope assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:45
- [x] Runtime, no diff can show it: with a round 1 claiming every criterion met on files the diff never touched, a second run appends a round scored from the diff alone and leaves round 1 untouched. — not-applicable, a model's run over a seeded fixture is runtime behaviour no diff holds
- [x] A phase outside the diff gets one `Out of the diff:` line, named as the plan names it, in plan order, holding no box. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:19
- [x] Each score and status assertion reddens alone under the mutation of the rule it names. — scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:121
- [x] A plan of 6 criteria whose diff touches one phase of 2, with 1 met, reads `1/6 met, 1 unmet, 4 out of the diff`; with no plan it reads `not scored`. — plugins/aidd-dev/skills/05-review/actions/02-review-functional.md:24
- [x] A criterion on runtime timing is checked `not-applicable` and counted as met; a round with no criterion in scope does not read `approve`; a three-axis run writes findings keyed on a `file:line`, each with its fix. — plugins/aidd-dev/skills/05-review/references/review-rubric.md:16

### Findings

- `scripts/__tests__/a-review-appends-a-round-and-scores-the-whole-plan.test.js:130` : the lookahead `(?![^.]*\bno\b)` exempts any sentence holding the word "no" before its period, so "an unmet criterion goes to `Findings` with no severity" passes the one-home scan → anchor the exemption on the negated phrase itself, e.g. `no \`Findings\`` — 🟢 minor, code
- `plugins/aidd-dev/skills/05-review/SKILL.md:19` : the flow draws a later run only from `changes`, while a `blocked` round is re-reviewed after its fix too → add `blocked -.->|a later run| all` — 🟢 minor, rot
