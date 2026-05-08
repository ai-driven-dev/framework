# Auth modes

Three supported sources for the GitHub token used by `aidd-orchestrator:02:run` and `aidd-orchestrator:03:review`.

## gh CLI (default)

- Read token from `gh auth token` at runtime.
- Pros: zero extra setup if the user already runs `gh`. Local mode only.
- Cons: not available on CI runners; needs interactive login or `gh auth login --with-token`.

## Personal Access Token (PAT)

- Read from env var named in `auth.pat_env_var` (default `GITHUB_TOKEN`).
- Pros: works in CI and Desktop. Simple.
- Cons: long-lived secret; broad scope. Not recommended for org compliance.

## GitHub App

- Configure `auth.github_app = { app_id, private_key_path, installation_id }`.
- Pros: scoped per install, revocable, audit trail in GitHub UI. Best for enterprise.
- Cons: setup is heavier (app creation, install per repo or org).

## Resolution order

1. If `auth.source == "gh-cli"`: try `gh auth token`. On failure, fall back to `auth.fallback`.
2. If `auth.source == "pat"`: read env var; abort if missing.
3. If `auth.source == "github-app"`: mint an installation token via the App private key; abort on signing failure.

## Tradeoffs

| Mode       | Local | CI  | Compliance | Setup cost |
| ---------- | ----- | --- | ---------- | ---------- |
| gh CLI     | yes   | no  | low        | none       |
| PAT        | yes   | yes | medium     | low        |
| GitHub App | yes   | yes | high       | high       |
