# Review: {{the plan's title, else the task folder's slug}}

## Round {{the count of round headings, this one included}}

- Diff: `{{base}}...{{short sha of HEAD}}`
- Uncommitted changes: {{yes | no}}
- Axes: {{the axes that ran}}
- Verdict: {{approve | changes-requested | blocked}}
- Score: {{n_met}}/{{n_plan}} met, {{n_unmet}} unmet, {{n_unverified}} unverified at runtime, {{n_out}} out of the diff, or not scored

### Criteria

- [x] {{criterion met}} — {{file:line, or the run record}}
- [ ] {{criterion unmet}} — {{gap}}
- Unverified at runtime: {{criterion}} — {{what a run would show}}
- Out of the diff: {{phase-name}} ({{n}} criteria)

### Findings

- `{{file:line}}` : {{issue}} → {{fix}} — {{🔴 critical | 🟡 major | 🟢 minor}}, {{kind}}

### Limits

- {{a shape nothing can reach}} — {{why}}

<!-- Append one round per pass, never rewrite an earlier one. Replace every `{{...}}`, delete every comment, and leave out a list with nothing to hold. -->
