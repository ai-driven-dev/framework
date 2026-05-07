# 02 -- Ask Config

Interactively collects runtime parameters from the user.

## Inputs

- `detection` (required) -- detection report from `01-detect-context`

## Outputs

```json
{
  "mode": "both",
  "labels": {
    "ready": "ai:ready",
    "running": "ai:running",
    "blocked": "ai:blocked"
  },
  "auth": { "source": "gh-cli", "fallback": "pat" },
  "webhook_url": null,
  "max_iterations": 3,
  "monorepo_scope": "codeowners",
  "trigger_mention": "@claude /implement",
  "project_board_column": "Ready"
}
```

## Depends on

- `01-detect-context`

## Process

1. Ask `mode`: one of `local`, `remote`, `both`. Default `both`.
2. Ask label names. Defaults: `ai:ready`, `ai:running`, `ai:blocked`. Validate they are not already used for another purpose by querying `gh label list`.
3. Ask `auth.source`: `gh-cli` (default if `gh auth status` succeeds), `pat` (env var name), or `github-app` (app id + private key path). See `references/auth-modes.md`.
4. Ask whether a SIEM webhook URL is needed; if yes, validate URL format (https only).
5. Ask `max_iterations` for the review-fix loop; default `3`.
6. If `detection.monorepo` is true: ask `monorepo_scope`: `codeowners` (default) or `path-label` (require label prefix `area:`).
7. Ask the trigger mention string; default `@claude /implement`.
8. Ask the project board column name; default `Ready`.
9. Emit the JSON above; do NOT persist yet.

## Test

Run interactively in a sandbox; the action returns valid JSON that satisfies the example schema, all enum fields hold one of the documented values, and `webhook_url` is either `null` or a valid `https://` URL.
