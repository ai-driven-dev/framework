# Testing

How `cli/` is tested. Levels, guards and the review grid: [`actions/05-test.md`](../../../.claude/skills/working-on-cli/actions/05-test.md). Where a context's tests and kit sit: [`actions/06-context.md`](../../../.claude/skills/working-on-cli/actions/06-context.md).

## Projects

| Project | Selects | Setup |
| --- | --- | --- |
| `unit`, `contract`, `integration`, `e2e` | `tests/**/*.<name>.test.ts` | e2e builds the binary once, under `.e2e-build/` |
| `golden` | `tests/golden/**/*.golden.test.ts` | builds the binary once, under `.e2e-build/` |
| `architecture` | `tests/architecture/**/*.arch.test.ts` only | none |

## Commands

| Command | Runs |
| --- | --- |
| `pnpm test` | every project; e2e and golden build into `.e2e-build/`, never `dist/` |
| `pnpm test:unit`, `test:contract`, `test:integration`, `test:e2e`, `test:golden`, `test:arch` | one project |
| `pnpm golden:update [name]` | rewrites the stored goldens, or those under `tests/golden/<name>*`; refused in CI |
| `pnpm smoke` | the built binary over `scripts/smoke-tools.sh`, hermetic |
| `pnpm smoke:full`, `smoke:collision` | the remote fetch; a person's own install left as seeded |
| `pnpm smoke:real` | real host registries: [`smoke-real.md`](internal/smoke-real.md) |

## Where each guard runs

| Guard | Pre-commit | Pre-push | CI |
| --- | --- | --- | --- |
| Biome, typecheck, `architecture` project, type honesty | yes | no, replayed by CI | `cli-lint`, `cli-typecheck`, `cli-architecture` |
| Debt shrink, knip, `jscpd`, `jscpd:profiles`, recipe validity | no | yes | the debt shrink runs in `cli-architecture`; `cli-knip`, `cli-jscpd`, `cli-build` |
| `unit`, `contract`, `integration`, `e2e`, `golden` | no | yes | `cli-coverage` |
| `tooling` project | no | no, CI only: it is the slowest and needs a real tool config | `cli-coverage` (every project) and the Windows and macOS jobs |

CI only, because each costs minutes or needs a runner the machine lacks:

- Bundle size budget: runs in `cli-build`, which builds the binary.
- Coverage thresholds: `cli-coverage`, a full instrumented run.
- Smoke, kilo runtime, identifier join, claude tokens: `cli-smoke`, `cli-kilo-runtime`, `identifier-join`, `claude-tokens`; each starts a real host binary or a pseudo-terminal.
- Mutation and its score: `cli-mutation`, `cli-mutation-score`; hours of work, scoped per change.
- `kanban` suite: `kanban-checks`; no local job fires on `kanban/` alone.

## Mutation

- Scopes and floors: `mutation-scopes.json`. A scope with a floor (`telemetry`, `shared`) runs per pull request when its source or its declared tests changed, and the canary runs only with the full set; a change to `stryker.conf.json`, `vitest.mutation.config.ts` or the scopes file runs all. Scopes without a floor run in the weekly schedule and by `workflow_dispatch`, and never fail. Selection: `scripts/mutation-scopes-to-run.mjs`.
- Run: `pnpm test:mutation:<scope>`, or `node scripts/run-mutation.mjs --changed [<base>]` before a push.
- A floor is raised to the measured score after a run, never lowered without the reason in that file.

## Fixtures and sandbox

- `tests/fixtures/` is read-only; mutate a copy in a temp directory.
- A temp directory is `mkdtemp(join(tmpdir(), "aidd-<thing>-"))`; the prefix is what the repository root's `scripts/sweep-stale-test-dirs.cjs` reclaims, loaded by `tests/setup/sweep-stale-temp-dirs.ts`.
- A sandboxed run relocates `HOME`, `XDG_CONFIG_HOME`, `USERPROFILE`, `APPDATA` and `CODEX_HOME` and narrows `PATH` (`tests/shared/testing/cli-sandbox.builder.ts`, held by `sandbox-reaches-no-tool-binary.e2e.test.ts`).
- Never run `setup`, `marketplace add` or `plugin install` at the repository root: it tracks `.codex/`, `.agents/` and `.claude/`, so use a fresh temp directory.
- Green unit and integration tests prove output shape, never that a tool consumes it: that is `pnpm smoke`.
- `setup` always registers the marketplace as `aidd-framework`: [`marketplace-identity-is-name-plus-plugins.md`](internal/decisions/marketplace-identity-is-name-plus-plugins.md).
