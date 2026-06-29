# 05 -- Bootstrap Labels

Creates the 5 lifecycle labels declared in the config if they do not already exist on the repo.

## Input
- `answers` (required) -- config object from `02-ask-config`

## Output
```json
{
  "created": ["to-implement", "claude/working"],
  "already_present": ["to-review", "claude/awaiting-review", "claude/blocked"]
}
```


## Process

1. Fetch existing labels: `gh label list --json name --jq '.[].name'`.
2. For each label in `answers.labels` (`to_implement`, `to_review`, `working`, `awaiting_review`, `blocked`):
   - If already present, add the label name to `already_present`.
   - Otherwise create it with the matching color and description:
     - `to_implement` -> color `0E8A16` (green), description "Human request: Claude, implement this issue"
     - `to_review` -> color `0E8A16` (green), description "Human request: Claude, apply the review feedback on the linked PR"
     - `working` -> color `FBCA04` (yellow), description "Claude is working (lock)"
     - `awaiting_review` -> color `1D76DB` (blue), description "Claude opened a PR; waiting for human review"
     - `blocked` -> color `B60205` (red), description "Failure or dependency blocker; human takeover required"
   - Use `gh label create <name> --color <hex> --description <text>`.
3. Emit the result JSON. Do not abort on label-create failure: log the error and continue.

## Test

After running on a repo without the labels: `gh label list --json name --jq '.[].name' | grep -E '^(to-implement|to-review|claude/(working|awaiting-review|blocked))$' | wc -l` returns `5`. Re-running returns `created = []` and `already_present` containing all five.
