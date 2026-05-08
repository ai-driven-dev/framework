---
name: aidd-async-dev:01:setup
description: Installs and configures the aidd-async-dev plugin in a target repo. Use when the user runs "/setup async dev", "configure async dev", "install async-dev plugin", or asks to set up Claude auto-implementation on issues. Do NOT use for running the async pipeline (use the run skill) or handling PR review loops (use the review skill).
---

# Setup

Sets up async-dev in a repo: detects context, asks the user for a small set of runtime parameters, generates the GitHub Actions workflow, persists the config, and bootstraps the lifecycle labels. One-shot, manual.

## Available actions

| #   | Action               | Role                                                   | Input                |
| --- | -------------------- | ------------------------------------------------------ | -------------------- |
| 01  | `detect-context`     | Detect repo platform and discover an SDLC capability   | repo cwd             |
| 02  | `ask-config`         | Collect mode, marketplace, auth, max-iterations        | detection report     |
| 03  | `generate-workflow`  | Render `.github/workflows/aidd-async.yml` from template | answers              |
| 04  | `write-config`       | Persist `.claude/aidd-async-dev.json`                  | answers              |
| 05  | `bootstrap-labels`   | Create the 5 lifecycle labels on the GitHub repo       | answers              |

## Default flow

Sequential: `01 -> 02 -> 03 -> 04 -> 05`. No skipping.

## Lifecycle labels

The plugin defines two namespaces with strict ownership.

| Label                     | Posed by | Meaning                                                 |
| ------------------------- | -------- | ------------------------------------------------------- |
| `to-implement`            | Human    | "Claude, implement this issue."                        |
| `to-review`               | Human    | "Claude, apply the review feedback on the linked PR."  |
| `claude/working`          | Claude   | Pipeline lock; a run is in progress.                   |
| `claude/awaiting-review`  | Claude   | A PR is open and is waiting for human review.          |
| `claude/blocked`          | Claude   | Failure or dependency blocker; human takeover needed.  |

The pipeline auto-routes: when the human applies `to-implement` (or `to-review`) on an issue, the workflow checks whether an open PR is linked to that issue. If yes, it dispatches to the review skill; otherwise to the run skill. Mention triggers (`@claude /implement`, `@claude /review`) work the same way.

## Transversal rules

- Never overwrite existing files without explicit user confirmation.
- All generated files use English only.
- Auth choice defaults to `oauth_token` when the user has a Claude Pro/Max subscription.
- If no SDLC orchestration capability is discovered at action 01, ask the user whether to continue (warn that the run skill will fail at delegation time).

## References

- `references/auth-modes.md` -- comparison of gh CLI, PAT, and GitHub App auth (how the plugin reads/writes GitHub)
- `references/claude-action-auth.md` -- comparison of OAuth token (Claude Pro/Max) vs API key (how the GitHub Action authenticates to Anthropic)

## Assets

- `assets/workflow-template.yml` -- GitHub Actions workflow skeleton
- `assets/config-template.json` -- `.claude/aidd-async-dev.json` skeleton
