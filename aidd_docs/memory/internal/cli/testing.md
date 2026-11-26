# CLI Testing

Levels, guards, review grid: [`actions/05-test.md`](../../../../.claude/skills/working-on-cli/actions/05-test.md). Context tests: [`actions/06-context.md`](../../../../.claude/skills/working-on-cli/actions/06-context.md).

## Projects

| Project | Selects | Setup |
| --- | --- | --- |
| `unit`, `contract`, `integration`, `e2e` | `cli/tests/**/*.<name>.test.ts` | e2e builds once, into `.e2e-build/` |
| `golden` | `cli/tests/golden/**/*.golden.test.ts` | same build |
| `architecture` | `cli/tests/architecture/**/*.arch.test.ts` | |
| `tooling` | CI only: needs a real tool config | none |

## Commands

Run from `cli/`.

- `pnpm test` never builds `dist/`; `tooling` is not among its projects.
- `pnpm golden:update [name]` rewrites stored goldens, or those under `cli/tests/golden/<name>*`; refused in CI.
- `pnpm smoke` runs the built binary over `cli/scripts/smoke-tools.sh`, hermetic; `smoke:full` and `smoke:collision` add the remote fetch and a seeded own install.
- `AIDD_SMOKE_KIRO=1 pnpm smoke:kiro` runs a logged-in `kiro-cli` turn over a project set up for Kiro; opt-in, never in CI, skipped without the variable.
- `pnpm test:host-contract` replays recorded host behaviour on installed hosts; a weekly CI job.
- `pnpm smoke:real` reaches real host registries: [`smoke-real.md`](smoke-real.md).

## Gates

| Gate | Commands | CI job |
| --- | --- | --- |
| pre-commit | `pnpm lint` (biome and `cli/biome-plugins/`), `pnpm typecheck`, `pnpm test:arch`, `node scripts/check-cli-type-honesty.mjs` from the root | `cli-lint`, `cli-typecheck`, `cli-architecture` |
| pre-push | `pnpm knip`, `pnpm knip:production`, `pnpm jscpd`, `pnpm jscpd:profiles`, every project but `tooling` and `architecture` | `cli-knip`, `cli-jscpd`, `cli-build`, `cli-coverage` |
| CI only | the jobs of `cli-ci.yml` | `cli-coverage`, `cli-build`, `cli-smoke`, `cli-mutation` |

- Every job fans into the required check `cli / gate` in `.github/workflows/cli-ci.yml`.

## Mutation

Scopes, floors and when each runs: [`mutation.md`](mutation.md).

## Fixtures and sandbox

- `cli/tests/fixtures/` is read-only: mutate a copy.
- Name a temp folder `mkdtemp(join(tmpdir(), "aidd-<thing>-"))`; `scripts/sweep-stale-test-dirs.cjs` reclaims that prefix.
- A sandboxed run relocates `HOME`, `XDG_CONFIG_HOME`, `USERPROFILE`, `APPDATA`, `CODEX_HOME` and narrows `PATH`.
- Built by `cli/tests/shared/testing/cli-sandbox.builder.ts`, guarded by `cli/tests/e2e/sandbox-reaches-no-tool-binary.e2e.test.ts`.
- Never run `setup`, `marketplace add` or `plugin install` at the repository root: it tracks `.codex/`, `.agents/`, `.claude/`.
- Unit and integration tests prove output shape; only `pnpm smoke` proves a tool consumes it.
