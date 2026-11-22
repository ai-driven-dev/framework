# Testing

How the project is tested: the layers, the tools, and the conventions. Where tests live and how to run them.

> CLI internals (tiers, fixtures, naming, mocking) live in [`cli/aidd_docs/memory/testing.md`](../../cli/aidd_docs/memory/testing.md). This page is the repository-wide view.

## Strategy

| Surface | Validated by |
| --- | --- |
| Skills, agents, hook configs, plugin manifests | the contract of each kind, run over the tree by `node scripts/check/run.cjs` (CI job `lefthook`, step "Check framework content"): only findings absent from the baseline in `scripts/check/baseline.json` fail. The pre-commit hook `framework-content` runs it on the staged files with `--fix`; `architecture-rules` keeps router coherence for a skill with no flowchart |
| Plans, runs, rules, commands, stories | the contract beside the skill that writes them, run by its `validate-<kind>.cjs`; archived plans are not validated in CI. New kind: copy `02-user-stories/scripts/` (`contract.json`, `validate-story.cjs`), add `scope` for the turn-end check (`"shell": false` when an install writes the kind: a shell turn then judges only the files a command names), then run `node scripts/check/engine/sync.cjs` |
| `scripts/` and bundled hooks | `node --test` under the wrapper below |
| `cli/` | vitest, four projects — see the CLI bank |
| `kanban/` | its own vitest suite. It shares no code with `cli/` |
| Per-tool distributions | golden snapshots in `cli/tests/golden/`, mirrored by the `build-per-tool` CI matrix; Claude Code's own `plugin validate` over a fresh claude build, in `cli-ci.yml` |
| Browser journeys | `aidd-qa:01-acceptance-qa`, see below |

Baseline keys in `scripts/check/baseline.json` start with the file path. On a skill rename, rewrite that path prefix in its keys in the same commit, or `run.cjs` reports the old findings as fresh and the old keys as gone.

## Tools

| Tool | Use |
| --- | --- |
| vitest | `cli/`, `kanban/` |
| stryker | mutation, per CLI scope, gated in `cli-ci.yml` on the scopes a change touches |
| knip | dead code, before push and in `cli-ci.yml` |
| `@playwright/cli` | browser QA evidence, pinned, never an app dependency |

## Conventions

- A plugin never holds its own tests: `hooks/` ships recursively into user projects. Tests for a bundled script go in `scripts/__tests__/`.
- The scripts suite writes into a git repository. Run it wrapped, never bare: unwrapped it can overwrite this repository's own `.git/hooks`, and `.git` is in no history.
- A new or rewritten skill runs end to end on at least two small models from different providers before it ships, in a throwaway repository whose sessions are deleted after. It must stop at each wait and write only once approved.

## Run

| Command | Scope |
| --- | --- |
| `pnpm test:changed` | only the specs a change can break — vitest resolves the CLI's import graph, and the plugin specs are selected by the paths their own text names. What to run while working |
| `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | repository scripts and hooks |
| `cd cli && pnpm test` | the four CLI projects. It does not build |
| `cd cli && pnpm smoke` | built binary against `cli/scripts/smoke-tools.sh` |
| `cd kanban && pnpm test` | the board |
| `pnpm exec lefthook run pre-push` | the local gate before pushing |

CI runs more. `validate.yml` re-runs the whole pre-commit over the whole tree on every push and pull request. `cli-ci.yml` adds jobs no local hook has. Both are in `deployment.md`.

## Browser QA

- Runner: `npx --yes @playwright/cli@0.1.17`, the framework pin. Never `latest` during QA.
- Also required: `ffmpeg` and `ffprobe`. Output is WebM evidence per scenario.
- Owned by `aidd-qa:01-acceptance-qa`; this repository ships the capability, it has no browser journey of its own.
