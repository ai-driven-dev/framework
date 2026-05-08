# 04 -- Write Config

Persists the plugin configuration to the repo.

## Inputs

- `answers` (required) -- config object from `02-ask-config`

## Outputs

A file at `.claude/aidd-async-dev.json`.

## Depends on

- `02-ask-config`

## Process

1. Read `assets/config-template.json`.
2. Merge `answers` into the template, preserving template defaults for fields the user did not override.
3. Add a top-level `version` (the plugin version) and an ISO 8601 `created_at` timestamp.
4. If `.claude/aidd-async-dev.json` already exists, diff against the new config and ask the user to confirm overwrite.
5. Write the file with 2-space indentation, ending in a newline.
6. The config has no secrets and is committed by design (it is the source of truth for the workflow).

## Test

After running, `jq '.version, .mode, .labels.to_implement' .claude/aidd-async-dev.json` returns the plugin version, the chosen mode, and the `to-implement` label name. `jq -e '.max_iterations >= 1' .claude/aidd-async-dev.json` exits 0.
