# aidd-orchestrator catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-orchestrator` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.mjs` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`skills`](#skills)
  - [`skills/01-setup-async-dev`](#skills01-setup-async-dev)
  - [`skills/02-run-async-dev`](#skills02-run-async-dev)
  - [`skills/03-review-async-dev`](#skills03-review-async-dev)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `skills`

#### `skills/01-setup-async-dev`

| Group | File | Description |
|-------|------|---|
| `assets` | [config-template.json](skills/01-setup-async-dev/assets/config-template.json) | - |
| `assets` | [local-daemon-template.sh](skills/01-setup-async-dev/assets/local-daemon-template.sh) | - |
| `assets` | [local-poll-template.sh](skills/01-setup-async-dev/assets/local-poll-template.sh) | - |
| `evals` | [scenarios.json](skills/01-setup-async-dev/evals/scenarios.json) | - |
| `references` | [auth-modes.md](skills/01-setup-async-dev/references/auth-modes.md) | - |
| `references` | [claude-action-auth.md](skills/01-setup-async-dev/references/claude-action-auth.md) | - |
| `references` | [local-mode-scheduling.md](skills/01-setup-async-dev/references/local-mode-scheduling.md) | - |
| `-` | [SKILL.md](skills/01-setup-async-dev/SKILL.md) | `Installs and configures the aidd-orchestrator plugin end-to-end in a target repo, up to and including the first triggered run. Use when the user runs "/setup async dev", "configure async dev", "install async-dev plugin", or asks to set up Claude auto-implementation on issues. Do NOT use for running the async pipeline (use the run skill) or handling PR review loops (use the review skill).` |

#### `skills/02-run-async-dev`

| Group | File | Description |
|-------|------|---|
| `evals` | [scenarios.json](skills/02-run-async-dev/evals/scenarios.json) | - |
| `-` | [SKILL.md](skills/02-run-async-dev/SKILL.md) | `Runs one async development pipeline cycle: polls issues labeled with the `to-implement` label (or its mention equivalent), resolves dependencies, locks the issue with `claude/working`, delegates implementation to whichever SDLC capability is loaded at runtime, opens a PR, and ends with the issue marked `claude/awaiting-review`. Use when a fresh issue is labeled or mentioned for implementation, or when the user says "run async dev", "implement ready issues", "process the async queue". Do NOT use for setup or for handling PR review comment loops; other skills in this plugin cover those.` |

#### `skills/03-review-async-dev`

| Group | File | Description |
|-------|------|---|
| `evals` | [scenarios.json](skills/03-review-async-dev/evals/scenarios.json) | - |
| `references` | [stop-conditions.md](skills/03-review-async-dev/references/stop-conditions.md) | - |
| `-` | [SKILL.md](skills/03-review-async-dev/SKILL.md) | `Handles the post-PR review-fix loop for runs created by this plugin's run skill. Triggered when the human labels the linked issue with `to-review` (or comments `@claude /review` on the PR). Collects review comments, decides whether to keep iterating, delegates fixes to whichever SDLC capability is loaded at runtime, replies to each addressed comment, resolves the threads, and posts a structured summary when stop conditions trigger. Use when the user (or a webhook / cron) says "handle review comments", "iterate on PR <n>", "address review feedback automatically", or invokes this skill on a specific PR. Do NOT use for the initial implementation or for setup; other skills in this plugin cover those.` |

