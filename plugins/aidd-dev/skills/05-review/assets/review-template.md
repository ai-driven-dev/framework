# Review: {{the plan's title, else the task folder's slug}}

## Round {{the count of round headings, this one included}}

- Diff: `{{base}}...{{short sha of HEAD}}`
- Uncommitted changes: {{yes | no}}
- Axes: {{the axes that ran}}
- Verdict: {{approve | changes-requested | blocked}}
- Score: {{n}} critical, {{n}} major, {{n}} minor
- Coverage: {{n}}/{{the plan's whole criteria total}} met, {{n}} unmet, {{n}} unverified at runtime, {{n}} out of the diff

### Criteria

- [x] {{criterion met}} — {{file:line, or the run record}}
- [ ] {{criterion unmet}} — {{gap}}
- Unverified at runtime: {{criterion}} — {{what a run would show}}
- Out of the diff: {{phase-name}} ({{n}} criteria)

### Findings

- `{{file:line}}` : {{issue}} → {{fix}} — {{🔴 critical | 🟡 major | 🟢 minor}}, {{kind}}

### Limits

- {{a shape nothing can reach}} — {{why}}

<!-- Append one round per pass, never rewrite an earlier one. Replace every `{{...}}`, delete every comment, and leave out what has nothing to hold. -->
