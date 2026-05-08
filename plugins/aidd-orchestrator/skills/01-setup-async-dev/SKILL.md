---
name: aidd-orchestrator:01:setup-async-dev
description: Installs and configures the aidd-orchestrator plugin in a target repo. Use when the user runs "/setup async dev", "configure async dev", "install async-dev plugin", or asks to set up Claude auto-implementation on issues. Do NOT use for running the async pipeline (use the run skill) or handling PR review loops (use the review skill).
---

# Setup

Sets up async-dev in a repo: detects context, asks the user for runtime parameters, then generates the artefacts that match the chosen mode (`remote`, `local`, or `both`), persists the config, and bootstraps the lifecycle labels. One-shot, manual.

## Available actions

| #   | Action               | Role                                                                  | Mode gate           |
| --- | -------------------- | --------------------------------------------------------------------- | ------------------- |
| 01  | `detect-context`     | Detect repo platform and discover an SDLC capability                  | always              |
| 02  | `ask-config`         | Collect mode, marketplace, auth, max iterations                       | always              |
| 03  | `generate-workflow`  | Render `.github/workflows/aidd-async.yml`                             | `remote` or `both`  |
| 04  | `generate-local-script` | Render `scripts/aidd-async-poll.sh` and a launchd/cron snippet     | `local` or `both`   |
| 05  | `write-config`       | Persist `.claude/aidd-orchestrator.json`                                 | always              |
| 06  | `bootstrap-labels`   | Create the 5 lifecycle labels on the GitHub repo                      | always              |

## Default flow

Sequential: `01 -> 02 -> 03 -> 04 -> 05 -> 06`. Actions 03 and 04 self-skip when the chosen `mode` excludes them.

## Lifecycle labels

| Label                     | Posed by | Meaning                                                |
| ------------------------- | -------- | ------------------------------------------------------ |
| `to-implement`            | Human    | "Claude, implement this issue."                       |
| `to-review`               | Human    | "Claude, apply the review feedback on the linked PR." |
| `claude/working`          | Claude   | Pipeline lock; a run is in progress.                  |
| `claude/awaiting-review`  | Claude   | A PR is open and is waiting for human review.         |
| `claude/blocked`          | Claude   | Failure or dependency blocker; human takeover needed. |

## Modes

- **`remote`** -- GitHub Actions runs the pipeline. Fully managed by GitHub; no machine on the user's side needs to be online.
- **`local`** -- A poll script runs on the user's machine on a schedule (cron, launchd, or a Claude Code Desktop scheduled task). Useful for repos without GitHub Actions or for offline-first workflows.
- **`both`** -- Both surfaces enabled. The same labels and the same skills drive both. Concurrency is naturally deduplicated by the `claude/working` lock label.

## Transversal rules

- Never overwrite existing files without explicit user confirmation.
- All generated files use English only.
- Auth choice defaults to `oauth_token` when the user has a Claude Pro/Max subscription.
- If no SDLC orchestration capability is discovered at action 01, ask the user whether to continue (warn that the run skill will fail at delegation time).

## References

- `references/auth-modes.md` -- comparison of gh CLI, PAT, and GitHub App auth (how the plugin reads/writes GitHub)
- `references/claude-action-auth.md` -- comparison of OAuth token (Claude Pro/Max) vs API key (how the GitHub Action authenticates to Anthropic)

## Assets

- `assets/workflow-template.yml` -- GitHub Actions workflow skeleton (for `remote`)
- `assets/local-poll-template.sh` -- poll script skeleton (for `local`)
- `assets/config-template.json` -- `.claude/aidd-orchestrator.json` skeleton
