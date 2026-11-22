# Testing

How `cli/` is tested. Levels, guards and the review grid: [`cli-tests.md`](../../.claude/rules/cli-tests.md). Where a context's tests and kit sit: [`reference-context.md`](../../.claude/rules/cli-contexts/reference-context.md).

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
