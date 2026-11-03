# Review: {{the plan's title, else the task folder's slug}}

## Round {{the count of round headings, this one included}}

- Diff: `{{base}}...{{short sha of HEAD}}`
- Uncommitted changes: {{yes | no}}
- Axes: {{the axes that ran}}
- Verdict: {{approve | changes-requested | blocked}}, because {{what sets it}}

### Criteria

- [x] {{criterion met}} — {{file:line, or the run record}}
- [ ] {{criterion unmet}} — {{gap}}
- Unverified at runtime: {{criterion}} — {{what a run would show}}
- Out of the diff: {{phase-name}} ({{n}} criteria)

### Assumptions

- {{what the diff takes for granted}} — {{holds, finding or limit}}, checked at `{{file:line}}`

### Findings

- `{{file:line}}` : {{issue}}, proof `{{file:line}}` → {{fix}} — {{🔴 critical | 🟡 major | 🟢 minor}}

### Limits

- {{the doubt}} — {{what would settle it}}

<!--
- Append one round per pass, never rewrite an earlier one.
- Replace every `{{...}}` and delete every comment.
- Leave out what has nothing to hold.
-->
