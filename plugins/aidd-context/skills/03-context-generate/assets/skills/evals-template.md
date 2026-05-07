# Evaluation scenarios template

`evals/scenarios.json` is a minimal probe of trigger correctness. Auto-trigger skills only.

## Schema

```json
[
  { "prompt": "<user prompt verbatim>", "expect_action": "<slug>" },
  { "prompt": "<user prompt verbatim>", "expect_action": null }
]
```

- `prompt` - string, what a user would actually type.
- `expect_action` - slug of the action to dispatch, or `null` if the skill must NOT trigger.

## Rules

- ≥ 3 entries.
- No duplicate prompts.
- Every non-null `expect_action` must match a real action slug.

## Example (hypothetical `slack` skill)

```json
[
  { "prompt": "Post this update to #engineering", "expect_action": "post-message" },
  { "prompt": "Get the last 20 messages from #product", "expect_action": "get-history" },
  { "prompt": "Send an email to the team", "expect_action": null }
]
```
