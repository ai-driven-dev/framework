<!-- Review report for a diff. Fill the placeholders, drop this comment. Tables and boxes, never prose. Sections are fixed by assets/review-validator.yml. -->

# Review: {{feature}}

- **Verdict**: {{approve | changes-requested | blocked}}
- **Diff**: `{{base}}...{{head}}`
- **Axes run**: {{the axes that ran, from code, functional, relevancy}}
- **Date**: {{yyyy_mm_dd}}
- **Findings**: {{n_critical}} critical, {{n_warning}} warning, {{n_minor}} minor

## Phases

<!-- One block per plan phase, [x]/[ ] per acceptance criterion. Mark "Not run" when no plan was given or the functional axis did not run. -->

### Phase {{n}} — {{phase-name}}

- [x] {{criterion met}} — {{file:line}}
- [ ] {{criterion unmet}} — {{gap}}

## Findings

<!-- One table for every axis. Kind is `code`, `fit`, `conform`, `rot`, or `functional`. An unmet acceptance criterion tagged `fix` appears here as a `functional` row so the header count matches the verdict. Phase ties the row to the plan, or `-` with no plan. Each axis appends its own rows. Write "None." when a run found nothing. -->

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |

## Verification

<!-- Mark "Not run" when the functional axis did not run. -->

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | {{pct}}% ({{n_checked}}/{{n_total}})              |
| Files checked | {{files, comma-separated}}                        |
| Unchecked     | {{criterion — fix / not-applicable / fixed}}, or none |
| Unplanned     | {{change tracing to no criterion}}, or none       |
