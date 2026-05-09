---
name: aidd-orchestrator:01:setup-async-dev
description: Installs and configures the aidd-orchestrator plugin end-to-end in a target repo, up to and including the first triggered run. Use when the user runs "/setup async dev", "configure async dev", "install async-dev plugin", or asks to set up Claude auto-implementation on issues. Do NOT use for running the async pipeline (use the run skill) or handling PR review loops (use the review skill).
---

# Setup async-dev

Sets up async-dev in a repo. Goes from a fresh repo to a working pipeline: detects context, asks for runtime parameters, generates artefacts, bootstraps labels, installs user-scope plugins (local mode), configures secrets (remote mode), schedules the poll routine (local mode), commits and pushes the generated files, and offers a smoke test on the chosen issue.

## Available actions

| #   | Action                       | Role                                                                          | Mode gate           |
| --- | ---------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| 01  | `detect-context`             | Detect repo platform, default branch, SDLC capability, `claude` and `gh` CLI presence | always       |
| 02  | `ask-config`                 | Collect mode, marketplace, auth, max iterations                               | always              |
| 03  | `generate-workflow`          | Render `.github/workflows/aidd-async.yml`                                     | `remote` or `both`  |
| 04  | `generate-local-script`      | Render `scripts/aidd-async-poll.sh`                                           | `local` or `both`   |
| 05  | `write-config`               | Persist `.claude/aidd-orchestrator.json`                                      | always              |
| 06  | `bootstrap-labels`           | Create the 5 lifecycle labels on the GitHub repo                              | always              |
| 07  | `install-user-scope-plugins` | `claude plugin marketplace add` + `claude plugin install` orchestrator + SDLC | `local` or `both`   |
| 08  | `configure-remote-secrets`   | Prompt the user, then call `gh secret set` for each required secret           | `remote` or `both`  |
| 09  | `bootstrap-scheduling`       | Create a `/schedule` cloud routine OR print Desktop scheduled task steps      | `local` or `both`   |
| 10  | `commit-and-push`            | Stage the generated files, commit, push the branch                            | `remote` or `both`  |
| 11  | `smoke-test`                 | Create a throwaway issue, watch the first run land, then clean up the PR/issue/commit | always      |

## Default flow

Sequential: `01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11`. Each action self-skips when its mode gate is not satisfied. Action 11 is always offered but the user can decline (the skill exits cleanly).

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
- **`local`** -- A poll script runs on the user's machine, scheduled inside Claude Code (Desktop scheduled task or `/schedule` cloud routine). No OS-level cron.
- **`both`** -- Both surfaces enabled. The same labels and the same skills drive both. Concurrency is naturally deduplicated by the `claude/working` lock label.

## Transversal rules

- Never overwrite existing files without explicit user confirmation.
- All generated files use English only.
- Auth choice defaults to `oauth_token` when the user has a Claude Pro/Max subscription.
- If no SDLC orchestration capability is discovered at action 01, ask the user whether to continue (warn that the run skill will fail at delegation time).
- Every action that mutates state outside the repo (label creation, secret setting, plugin install, scheduling routine creation, push) asks for explicit confirmation before executing.

## References

- `references/auth-modes.md` -- comparison of gh CLI, PAT, and GitHub App auth (how the plugin reads/writes GitHub)
- `references/claude-action-auth.md` -- comparison of OAuth token (Claude Pro/Max) vs API key (how the GitHub Action authenticates to Anthropic)
- `references/local-mode-scheduling.md` -- the two Claude Code-native scheduling paths the bootstrap action picks from

## Assets

- `assets/workflow-template.yml` -- GitHub Actions workflow skeleton (for `remote`)
- `assets/local-poll-template.sh` -- poll script skeleton (for `local`)
- `assets/config-template.json` -- `.claude/aidd-orchestrator.json` skeleton
