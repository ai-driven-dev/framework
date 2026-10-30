# Run: {{the plan's title without its `Plan:` prefix}}

<!-- Append one `## Run` per pass, never rewrite an earlier one. One row per task of the plan. Replace every `{{...}}`, delete every comment. -->

## Run {{number}}

- Head: `{{sha of HEAD when the validations ran}}`
- Left: {{undone, uncommitted, or different from the plan; or none}}

| Task | Validation | Result |
| ---- | ---------- | ------ |
| {{phase.task, such as 1.2}} | {{scenario of that task's criterion, and the command that ran it}} | {{observable outcome}} |
