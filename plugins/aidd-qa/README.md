← [aidd-framework](../../README.md)

# aidd-qa

Acceptance QA with video evidence.

| | |
| --- | --- |
| Status | preview, off the recommended path |
| Install | `/plugin install aidd-qa@aidd-framework` |
| Start with | `/aidd-qa:01-acceptance-qa` |

## Skills

| Skill | Use it to |
| --- | --- |
| [`/aidd-qa:01-acceptance-qa`](skills/01-acceptance-qa/SKILL.md) | Check a reviewed change against its acceptance criteria and record a video per scenario |

## Limits

| Limit | Detail |
| --- | --- |
| Scenarios | Come from the acceptance criteria only, never from the diff or the code |
| Interface | Browser only |
| Not observable in a browser | Listed as out of interface, not tested |
