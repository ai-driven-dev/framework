# 05 -- Bootstrap Labels

Creates the GitHub labels declared in the config if they do not already exist on the repo.

## Inputs

- `answers` (required) -- config object from `02-ask-config`

## Outputs

```json
{
  "created": ["ai:ready", "ai:running"],
  "already_present": ["ai:blocked"]
}
```

## Depends on

- `04-write-config`

## Process

1. Fetch existing labels: `gh label list --json name --jq '.[].name'`.
2. For each label in `answers.labels` (`ready`, `running`, `blocked`):
   - If already present, add to `already_present`.
   - Otherwise create it with a sensible default color and description:
     - `ready` -> color `0E8A16` (green), description "Issue is ready for async Claude implementation"
     - `running` -> color `FBCA04` (yellow), description "Async Claude run in progress (lock)"
     - `blocked` -> color `B60205` (red), description "Async Claude run blocked, human takeover required"
   - Use `gh label create <name> --color <hex> --description <text>`.
3. Emit the result JSON. Do not abort on label-create failure: log the error and continue (other labels may still be creatable).

## Test

After running on a repo without the labels: `gh label list --json name --jq '.[].name' | grep -E '^ai:(ready|running|blocked)$' | wc -l` returns `3`. Re-running the action returns `created = []` and `already_present` = all three.
