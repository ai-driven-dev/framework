# Testing

CLI projects and gates: [`internal/cli/testing.md`](internal/cli/testing.md); mutation: [`internal/cli/mutation.md`](internal/cli/mutation.md).

## Strategy

| Surface | Validated by |
| --- | --- |
| Skills, agents, hook configs, plugin manifests | the contract of each kind, run over the tree by `node scripts/check/run.cjs` (CI job `lefthook`, step "Check framework content"): only findings absent from the baseline in `scripts/check/baseline.json` fail. The pre-commit hook `framework-content` runs it on the staged files with `--fix`; `architecture-rules` keeps router coherence for a skill with no flowchart |
| Plans, runs, rules, commands, stories | the contract beside the skill that writes them, run by its `validate-<kind>.cjs`; archived plans are not validated in CI. A new kind: [`docs/MAINTAINERS.md`](../../docs/MAINTAINERS.md#add-to-the-framework) |
| `scripts/` and bundled hooks | `node --test`, wrapped |
| `cli/`, `kanban/` | their own vitest suites; they share no code |
| Per-tool distributions | goldens in `cli/tests/golden/`, the `build-per-tool` CI matrix, Claude Code's `plugin validate` in `cli-ci.yml` |
| Browser journeys | `aidd-qa:01-acceptance-qa` |

Baseline keys in `scripts/check/baseline.json` start with the file path. On a skill rename, rewrite that path prefix in its keys in the same commit, or `run.cjs` reports the old findings as fresh and the old keys as gone.

## Conventions

- A plugin holds no tests: `hooks/` ships into user projects. A bundled script's tests go in `scripts/__tests__/`.
- Run the scripts suite wrapped: bare, it can overwrite this repository's `.git/hooks`.
- Delete each chat a CLI test of an AI tool creates, once the test is done.

## Run

| Command | Scope |
| --- | --- |
| `pnpm test:changed` | only the specs a change can break; run it while working |
| `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | repository scripts and hooks |
| `cd kanban && pnpm test` | the board |

- `validate.yml` reruns the whole pre-commit over the whole tree; `cli-ci.yml` adds jobs no hook has (`internal/deployment.md`).

## Browser QA

- Runner: `npx --yes @playwright/cli@0.1.17`, pinned; never `latest`.
- Needs `ffmpeg` and `ffprobe`; each scenario yields WebM evidence.
- This repository ships the capability; it has no browser journey of its own.
