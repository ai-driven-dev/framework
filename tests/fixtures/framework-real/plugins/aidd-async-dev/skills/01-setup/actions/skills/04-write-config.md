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
3. Add a top-level `version: "0.1.0"` and an ISO 8601 `created_at` timestamp.
4. If `.claude/aidd-async-dev.json` already exists, diff against the new config and ask the user to confirm overwrite.
5. Write the file with 2-space indentation, ending in a newline.
6. Ensure `.claude/` is listed in `.gitignore` only if the user previously chose to keep secrets there; by default the config has no secrets and is committed.

## Test

`jq '.version, .mode, .labels.ready' .claude/aidd-async-dev.json` returns `"0.1.0"`, the chosen mode, and the chosen ready label; `jq -e '.webhook_url == null or (.webhook_url | startswith("https://"))' .claude/aidd-async-dev.json` exits 0.
