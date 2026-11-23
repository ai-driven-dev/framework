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

| Command | Runs |
| --- | --- |
| `pnpm test` | every project; never builds `dist/` |
| `pnpm test:<project>` (`test:arch` for architecture) | one project |
| `pnpm golden:update [name]` | rewrites stored goldens, or those under `cli/tests/golden/<name>*`; refused in CI |
| `pnpm smoke` | the built binary over `cli/scripts/smoke-tools.sh`, hermetic |
| `pnpm smoke:full`, `smoke:collision` | the same with the remote fetch; a seeded own install |
| `pnpm test:host-contract` | recorded host behaviour replayed on installed hosts; weekly CI job |
| `pnpm smoke:real` | real host registries: [`smoke-real.md`](smoke-real.md) |

## Gates

| Gate | Commands | CI job |
| --- | --- | --- |
| pre-commit | `pnpm lint` (biome and `cli/biome-plugins/`), `pnpm typecheck`, `pnpm test:arch`, `node scripts/check-cli-type-honesty.mjs` from the root | `cli-lint`, `cli-typecheck`, `cli-architecture` |
| pre-push | `pnpm knip`, `pnpm jscpd:profiles`, debt shrink, recipe validity, `pnpm test` | `cli-knip`, `cli-jscpd`, `cli-build`, `cli-coverage` |
| CI only | coverage thresholds, bundle budget, `pnpm jscpd`, smoke, mutation | `cli-coverage`, `cli-build`, `cli-smoke`, `cli-mutation` |

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
