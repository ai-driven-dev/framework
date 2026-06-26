# aidd-orchestrator catalog

Auto-generated index of skills, agents, references and assets shipped by the `aidd-orchestrator` plugin.

> This file is automatically updated by the `scripts/summarize-markdown.js` script.

## Table of Contents

- [`.claude-plugin`](#claude-plugin)
- [`skills`](#skills)
  - [`skills/00-async-dev`](#skills00-async-dev)

---

### `.claude-plugin`

| File |
|------|
| [plugin.json](.claude-plugin/plugin.json) |

### `skills`

#### `skills/00-async-dev`

| Group | File | Description |
|-------|------|---|
| `references` | [routing.md](skills/00-async-dev/references/routing.md) | - |
| `-` | [SKILL.md](skills/00-async-dev/SKILL.md) | `Single entry point for the async-dev pipeline (setup, run, review). Hybrid router decides which sub-flow to execute from $ARGUMENTS keyword (`setup` / `run` / `review`), trigger source (label `to-implement` / `to-review`, comment `@claude /implement` / `/review`), repo state (workflow + config presence, PR linked to issue), or natural-language intent. Use when the user says "set up async dev", "run async dev on issue #N", "address review on PR #N", "/async-dev", "claude on issues", or when triggered by a webhook with the matching labels or comments. Do NOT use for plain status checks on the async pipeline or for SDLC orchestration unrelated to issue/PR automation.` |

