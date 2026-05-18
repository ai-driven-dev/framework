# Auth modes (local poll script)

How `scripts/aidd-async-poll.sh` authenticates against GitHub when running on a developer machine. This document covers the **local** path only; the **remote** (GitHub Actions) path uses `github_write_auth.mode` and is documented in [`../actions/02-ask-config.md`](../actions/02-ask-config.md) step 4.

The local poll script does not own a config object for authentication. It shells out to the `gh` CLI (`gh issue list`, `gh issue view`, `gh pr list`), and `gh` resolves credentials itself. Two practical sources are supported, with one fallback path between them.

## gh CLI session (default)

- The script calls `gh` directly; `gh` reads its session from `~/.config/gh/hosts.yml` after `gh auth login`.
- Pros: zero extra setup if the user already runs `gh`; credentials never touch the script's environment; refresh handled by `gh`.
- Cons: requires an interactive login once per machine; not viable in headless contexts where `gh auth login` cannot run.

## PAT via env var

- Set `GH_TOKEN` (preferred) or `GITHUB_TOKEN` in the shell that runs the poll script. `gh` honors either variable and bypasses the session file when one is present.
- Pros: works without an interactive login; same approach used by CI runners and Docker containers; easy to scope per shell session.
- Cons: long-lived secret in the environment; broad scope unless a fine-grained PAT is used; the operator is responsible for rotation.

Recommended scopes for the PAT: `Contents: Read`, `Issues: Read & Write`, `Pull requests: Read & Write`, `Metadata: Read`. The local poll never pushes commits; it only reads issues and labels and invokes `claude -p`, which does its own writes through the user's local git config.

## Resolution order

`gh` itself picks: `GH_TOKEN` wins over `GITHUB_TOKEN`, and either wins over the session file. So setting one of those env vars in the launch context (cron entry, launchd plist, systemd unit) overrides whatever `gh auth login` configured. Unset both env vars to fall back to the interactive session.

## Tradeoffs

| Source                  | Setup cost | Headless | Rotation | Best for                              |
| ----------------------- | ---------- | -------- | -------- | ------------------------------------- |
| `gh auth login` session | none       | no       | manual   | interactive dev machine               |
| `GH_TOKEN` env var      | low        | yes      | manual   | launchd / systemd / cron / containers |
