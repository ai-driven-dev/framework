# Testing

CLI projects, guards and mutation: [`internal/cli/testing.md`](internal/cli/testing.md).

## Strategy

| Surface | Validated by |
| --- | --- |
| Skills | the generator's validate step; pre-commit `skill-frontmatter`, `check-skill-argument-hints`, `architecture-rules` |
| Agents | `architecture-rules` over `plugins/*/agents/`, then a run against a real project |
| Rules | a run against a real project; no pre-commit guard reads them |
| `scripts/` and bundled hooks | `node --test`, wrapped |
| `cli/`, `kanban/` | their own vitest suites; they share no code |
| Per-tool distributions | goldens in `cli/tests/golden/`, the `build-per-tool` CI matrix, Claude Code's `plugin validate` in `cli-ci.yml` |
| Browser journeys | `aidd-qa:01-acceptance-qa` |

## Conventions

- A plugin holds no tests: `hooks/` ships into user projects. A bundled script's tests go in `scripts/__tests__/`.
- Run the scripts suite wrapped: bare, it can overwrite this repository's `.git/hooks`.
- A new or rewritten skill runs end to end on two small models from different providers, in a throwaway repository.
- That run must stop at each wait and write only once approved.
- Delete each chat a CLI test of an AI tool creates, once the test is done.

## Run

| Command | Scope |
| --- | --- |
| `pnpm test:changed` | only the specs a change can break; run it while working |
| `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | repository scripts and hooks |
| `cd cli && pnpm test` | every CLI project, no build |
| `cd kanban && pnpm test` | the board |

- `validate.yml` reruns the whole pre-commit over the whole tree; `cli-ci.yml` adds jobs no hook has (`internal/deployment.md`).

## Browser QA

- Runner: `npx --yes @playwright/cli@0.1.17`, pinned; never `latest`.
- Needs `ffmpeg` and `ffprobe`; each scenario yields WebM evidence.
- This repository ships the capability; it has no browser journey of its own.
