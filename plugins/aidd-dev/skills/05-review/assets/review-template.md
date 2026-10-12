# Review: {{feature}}

- Rounds: {{the count of round sections}}
- Started: {{round 1's date, never changed}}

## Round {{the count of round headings, this one included}} · r-{{4 hex characters, drawn once}}

- Date: {{yyyy-mm-dd}}
- By: {{git config user.name}}
- Diff: `{{base}}...{{head}}`{{ plus the working tree, when it held changes}}
- Axes: {{the axes that ran, from code, functional, relevancy}}
- Verdict: {{verdict}}
- Score: {{n_met}}/{{n_plan}} met, {{n_unmet}} unmet, {{n_unverified}} unverified at runtime, {{n_out}} out of the diff, or not scored

### Criteria

- [x] {{criterion met}} — {{file:line, or the run record}}
- [ ] {{criterion unmet}} — {{gap}}
- Unverified at runtime: {{criterion}} — {{what a run would show}}
- Out of the diff: {{phase-name}} ({{n}} criteria)

### Findings

- `{{file:line}}` : {{issue}} → {{fix}} — {{🔴 critical | 🟡 major | 🟢 minor}}, {{kind}}

<!-- Every placeholder is replaced by observed data, and a list no axis of this round owns is left out. One left standing is a bug. -->
