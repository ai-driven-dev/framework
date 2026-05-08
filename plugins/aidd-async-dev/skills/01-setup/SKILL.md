---
name: aidd-async-dev:01:setup
description: Installs and configures the aidd-async-dev plugin in a target repo. Use when the user runs "/setup async dev", "configure async dev", "install async-dev plugin", or asks to set up Claude auto-implementation on issues. Do NOT use for running the async pipeline (use `aidd-async-dev:02:run`) or handling PR review loops (use `aidd-async-dev:03:review`).
---

# Setup

Sets up async-dev in a repo: detects context, asks the user for runtime parameters, and writes the GitHub Actions workflow plus the plugin config file. One-shot, manual.

## Available actions

| #   | Action               | Role                                                   | Input                |
| --- | -------------------- | ------------------------------------------------------ | -------------------- |
| 01  | `detect-context`     | Detect repo platform and discover an SDLC capability   | repo cwd             |
| 02  | `ask-config`         | Interactively collect mode, labels, auth, webhook, max-N, monorepo scope | detection report     |
| 03  | `generate-workflow`  | Render `.github/workflows/aidd-async.yml` from template | answers              |
| 04  | `write-config`       | Persist `.claude/aidd-async-dev.json`                  | answers              |
| 05  | `bootstrap-labels`   | Create missing GitHub labels declared in config        | answers              |

## Default flow

Sequential: `01 -> 02 -> 03 -> 04 -> 05`. No skipping.

## Transversal rules

- Never overwrite existing files without explicit user confirmation.
- All generated files use English only.
- Auth choice defaults to `gh` CLI when present.
- If no SDLC orchestration capability is discovered at action 01, ask the user whether to continue (warn that the run skill will fail at delegation time).

## References

- `references/auth-modes.md` -- comparison of gh CLI, PAT, and GitHub App auth (how the plugin reads/writes GitHub)
- `references/claude-action-auth.md` -- comparison of OAuth token (Claude Pro/Max) vs API key (how the GitHub Action authenticates to Anthropic)

## Assets

- `assets/workflow-template.yml` -- GitHub Actions workflow skeleton
- `assets/config-template.json` -- `.claude/aidd-async-dev.json` skeleton
