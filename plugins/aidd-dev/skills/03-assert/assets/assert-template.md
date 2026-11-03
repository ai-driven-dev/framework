# Assert: {{the plan's title, else the task folder's slug}}

## Round {{the count of round headings, this one included}}

- Head: `{{short sha of HEAD before the checks ran}}`
- Uncommitted changes: {{yes | no}}
- Verdict: {{PASS | FAIL}}

| Check | Exit | Failure |
| --- | --- | --- |
| `{{command}}` | {{exit code, or not run}} | {{the one decisive error line, or empty}} |

<!-- Append one round per pass, never rewrite an earlier one. Replace every `{{...}}`, delete every comment. -->
