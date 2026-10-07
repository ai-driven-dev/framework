# Journey evidence

The phase's Test Scope, run end to end. Nothing in this repository evaluates
`spec-validator.yml`, and no gate validates a prose behaviour change, so each run is a fresh
independent context given the skill text and the task, and nothing else. Pass criteria were
fixed before the runs. No run was repeated to get a better answer.

## 1 - Thin request, three runs - FAIL

The request answers the target, the retention and the row cap, states no non-goals, and
carries no sentence suppressing further questions. The earlier clean result used one, which
is why it proved nothing.

> Finance users need to export their invoices as CSV. A user picks a date range and gets a
> downloadable file. An export stays downloadable for 7 days after it is generated. An export
> covering more than 50,000 rows is refused.

Pass criterion: none of the three runs asks a question about implementation or presentation
detail. Measured: five, four and six entries, and two of the three ask which fields the CSV
must carry. Two of the three also ask what the user is told on refusal and after the window
closes.

Run 1:
```markdown
## Open Questions

- TBD: Which invoice date does the selected date range filter on (issue date, due date, or payment date), and are both range endpoints inclusive?
- TBD: Which invoices may a finance user export (all invoices in their organization, or a narrower set), and how is "finance user" determined?
- TBD: Does the 50,000-row limit count invoices or invoice line items?
- TBD: When an export is refused for exceeding 50,000 rows, what must the user be told (for example the row count or a prompt to narrow the range)?
- TBD: After the 7-day window ends, must the user be able to see that the export expired, or may it simply disappear?
```

Run 2:
```markdown
## Open Questions

- TBD: Which invoice date does the selected date range filter on (issue date, due date, or payment date)?
- TBD: Does a "row" in the 50,000 limit mean one invoice or one invoice line item?
- TBD: Which fields must each exported CSV row contain?
- TBD: Which invoices may a finance user export (all invoices, or only those within their own organization or entity)?
```

Run 3:
```markdown
## Open Questions

- TBD: Which invoice date does the selected range filter on (issue date, due date, or payment date)?
- TBD: What counts as a row toward the 50,000 limit: one invoice, or one invoice line item?
- TBD: Which invoices may a finance user export (all invoices, or only those of their own organization or account)?
- TBD: Which invoice fields must the CSV contain?
- TBD: What must the user see when an export is refused for exceeding 50,000 rows?
- TBD: What must the user see when they try to download an export after its 7 days have passed?
```

The widened unit did not bound which gaps are raised. It bounds where they are written, and
that holds. `01-build.md` says to list every gap as `tbd-marker.md` defines it, and
`tbd-marker.md` excludes what no required section depends on. A drafter applied the placement
rule in every run and the exclusion in one.

## 2 - The measured case, one run - PASS

The two decisions #626 measured, left open:

> We have not decided how long an export stays downloadable once it is generated, nor the
> maximum number of rows a single export may cover.

Pass criterion: both are still listed. The widened unit must not lose the case the issue
measured.

```markdown
## Open Questions

- TBD: How long does a generated export stay downloadable before it expires?
- TBD: What is the maximum number of rows a single export may cover?
```

## 3 - The validator, two runs - PASS

Each run is a fresh context given `spec-validator.yml` and one spec, asked whether the spec
is valid and why. Both cases are `phase-1.md`'s own edge cases, and neither had ever been
run. They stand in for a gate that arrives with #625.

A spec carrying one residual `## Open Questions` entry:

```
VERDICT: invalid

- The hard threshold `open_questions_unresolved` forces invalid. The Open Questions section lists one unresolved gap: "Which invoice date does the selected date range filter on?"
- Target, Hard constraints, Non-goals and Done-when each meet their criteria, and the `TBD:` marker sits only inside Open Questions, which is allowed.
- The score is 90 (stakeholders and context are absent), which meets `pass_threshold: 90`, but a hard threshold overrides the score.
```

A spec whose `## Open Questions` reads `None` while a `TBD:` sits under `## Context`, the
second of the two placements #626 measured:

```
VERDICT: invalid

- `open_questions` (required, hard threshold `open_questions_unresolved`): a `TBD:` marker sits in Context, outside Open Questions. Open Questions reads "None" even though that gap is unresolved, so the criterion isn't fulfilled.
- Context says the range filters on issue date, then asks which date it filters on. The spec contradicts itself.
- The other required criteria (target, hard_constraints, non_goals, done_when) are fulfilled, but one unfulfilled required criterion forces invalid.
```

Before this change the criterion was ambiguous about its scope, and on the section-only
reading that second spec validated. It now refuses it, and names the reason.

## What these runs did not measure

The three thin-request runs were asked for the `## Open Questions` section alone, so they
re-measure the unit, not the placement. Placement rests on the previous round's eight
drafts, each of which carried no marker outside that section.
