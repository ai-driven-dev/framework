# Testing

How this package is tested: the layers, the tools, the conventions.

## Policy

### What earns a test

- A test pins one behaviour a caller or a user can observe, once, at the lowest level that proves it.
- A behaviour proven at one level is not proven again at another.
- Tested: domain rules and decisions, parsing at a boundary, every error a user can reach.
- Not tested: wiring, delegation, getters, re-exports, static declarations (a tool profile's data), and states the types already forbid.
- A test that would only restate the implementation is not written.

### Levels

| Level | Holds | Count |
| --- | --- | --- |
| unit | the bulk of the suite: domain rules, use cases and commands with in-memory doubles; no disk, process or network | one per rule, decision or error, cases in a table |
| contract | one suite per port, run on the double and the real adapter | one per port |
| integration | an adapter against the system it talks to: file system, git, a host CLI, the network | the cases that system can produce |
| e2e | the built binary over a main user journey | the main journeys only, never every case |
| golden | full output bytes | help text and generated distributions only |
| arch | rules about `src/` structure | one per rule |

### When to write it

- Bug fix: the failing test first, red for the reason its name gives.
- New domain rule: test first.
- Refactor, move, rename, wiring: no new test. Existing tests move with the code.
- Characterization: only for moved code that no test covers. It is deleted at the end of the refactor, or kept as that behaviour's one test.
- A new check (arch test, lint rule) is proven once in its PR by a planted break, written in the PR. The planted break is not kept as a test.

### Thresholds

| Gate | Value | Where |
| --- | --- | --- |
| Mutation floor | 80, domain scopes only (`src/kernel/**`, `src/contexts/*/domain/**` except `tools/domain/profiles/**`) | `mutation-scopes.json` |
| Mutation elsewhere | no scope, no floor | `mutation-scopes.json` |
| Mutation ratchet | none: a floor is not raised to the measured score | `mutation-scopes.json` |
| Coverage | reported in CI, gates nothing | `vitest.config.ts` |
| Test file size | 400 lines fails; files over it today sit in a shrink-only baseline | `test-file-size.arch.test.ts` |
| PR size | a reviewer challenges a feature whose test lines outgrow its source lines (`git diff --shortstat <base> -- src tests`) | review |

### Review

- A reviewer's test findings are: a duplicate across levels, a test of wiring, a missing test of an error a user can reach.
- "Add a test" needs the behaviour it pins, not a coverage line.

## Strategy

- Four vitest projects (`vitest.config.ts` → `test.projects`): `unit`, `integration`, `e2e` select by extension anywhere under `tests/`; `architecture` selects `tests/architecture/**/*.arch.test.ts` only, so a stray `*.arch.test.ts` runs nowhere.
- What each level holds, and how many tests it gets: the Levels table in the Policy above.

## Tools

- `vitest`, `fast-check` for properties, `ink-testing-library` for terminal views.
- `stryker` for mutation, on the domain scopes only, a gate in CI on the scopes a change touches.
- Vitest 5 uses canonical `fullTestName` values for filtered runs. The pnpm patch for `@stryker-mutator/vitest-runner@10.0.0` uses that same name in runner IDs and worker coverage IDs. It is specific to Vitest 5; remove or reassess it when upgrading the runner. The canary checks nested hierarchy collisions, literal spaces and regex characters, and that each dynamic mutant runs exactly its covering test.
- `knip`, `jscpd`, `biome`.

## Conventions

- `tests/` mirrors `src/`; where it does not, the mirror is wrong.
- A tool profile's tests split by feature: `tests/contexts/tools/domain/profiles/<tool>/<feature>.unit.test.ts` (`agents`, `skills`, `rules`, `commands`, `mcp`, `hooks`, `plugins`, `settings`, `content`), with the profile's own declarations in `profile.unit.test.ts`.
- Doubles from `tests/helpers/ports/`. Substitute at the seam; never mock functional behaviour.
- Fixtures in `tests/fixtures/`, read-only, excluded from JSON and link checks. Mutate a copy in a temp directory.
- `.gitattributes`'s `tests/fixtures/** text eol=lf` keeps byte-for-byte comparisons (`manifest-round-trip.unit.test.ts`) passing on Windows.
- A temp directory: `await mkdtemp(join(tmpdir(), "aidd-<thing>-"))`, never a fixed name (a plantable symlink). The prefix is what the repository-root `scripts/sweep-stale-test-dirs.cjs` reclaims.
- A test name is a phrase of observable behaviour; nested `describe` reads as a sentence. `E2E:` is a recurring legacy prefix, not one to copy.
- A golden snapshot is machine-independent, never derived from an absolute path: [`golden-machine-independence.md`](../../.claude/skills/test/references/golden-machine-independence.md).
- `describe.concurrent` appears in no unit or integration file; in e2e the golden and command-matrix suites use it. An observed split, not a rule.
- A bug fix's review reproduces the user's scenario against the built binary: [`bug-empirical-reproduction.md`](../../.claude/skills/test/references/bug-empirical-reproduction.md).
- A sandboxed run reaches no tool binary and no real profile: `tests/e2e/helpers.ts` narrows `PATH`, relocates `HOME`/`XDG_CONFIG_HOME`/`USERPROFILE`/`APPDATA` and `CODEX_HOME`, which Codex and the telemetry reader of its sessions read before `HOME`; `sandbox-reaches-no-tool-binary.e2e.test.ts` holds both.
- Records land under `AppData\Roaming` on Windows, `.config` elsewhere. Assert through the helper.
- Green unit and integration tests prove output shape, never that a tool consumes it: that is `pnpm smoke`.

## Run

- `pnpm test` runs every project; `test:unit`, `test:integration`, `test:e2e`, `test:arch` select one.
- `pnpm smoke` drives the real binary over the command matrix, hermetically. `pnpm smoke:full` adds the remote fetch.
- `pnpm smoke:real` reaches real host registries: [`smoke-real.md`](internal/smoke-real.md).
- `pnpm smoke:collision` runs the real `codex` and `copilot` binaries in a throwaway HOME against a person's own install under the keys aidd uses, and checks `setup` and `clean` leave it as seeded. `smoke:real`'s unique names cannot meet that case.
- `pnpm test:mutation:<scope>`; `mutation-scopes.json` declares each scope's globs (a leading `!` excludes) and the floor its score must hold. A weekly scheduled run replays every mutant with `--force`, so drift through a dependency an incremental run never replays is bounded to a week. `scripts/run-mutation.mjs` fails under the floor and keeps one incremental file per scope under `reports/mutation/<scope>/`; `--force` reruns every mutant. Before a run the runner prunes the incremental file to kills alone: stryker reuses a result unless the mutant's file or a test that covered it changed, so a test written after the fact never reaches a mutant recorded as survived, uncovered or static, and a scope measured 74 read 67 in CI until it did.
- `node scripts/run-mutation.mjs --changed [<base>]` mutates only the lines changed since `<base>` (default `origin/next`) and names each survivor with its file and line. It holds no floor and writes no scope's incremental file, so it checks a branch before a push without moving any gate.
- A mutation run orders test files through `tests/helpers/mutation-sequencer.ts`: unit before integration, smallest file first. Stryker stops a mutant at its first failure, so the cheap killer runs first; the ordinary `pnpm test` keeps Vitest's order.
- A unit or integration test never calls product code while it is collected (file top level, a `describe` body, an `it.each` table): Stryker scores code reached outside a test as static and reruns every related test for each of its mutants. Compute the value inside each test that uses it, not in `beforeAll` and not memoised.
- A unit or integration test reads the repository through `tests/helpers/repository-root.ts`, never by climbing `../` or `process.cwd()`: a mutation run copies `cli/` into a sandbox, where a relative climb lands nowhere (`tests-reach-the-repository-through-one-helper.arch.test.ts`).
- Read counts live: a suite failing before producing a test contributes zero.

## Gotchas

- Concurrent runs are safe: each e2e run builds under `.e2e-build/`. Nothing under `tests/` resolves into `dist/`.
- `pnpm test` does not build; `dist/` is another run's output.
- A reproduction or manual smoke runs in a fresh temp directory, never at the repository root, which tracks `.codex/config.toml` and `.codex/environments/environment.toml` and gitignores `.vscode/`.
- `setup`'s auto-register always names the marketplace `aidd-framework` (`FRAMEWORK_MARKETPLACE_NAME`, `contexts/distribution/domain/marketplace.ts`); no flag overrides it. Claude's own `add` silently overwrites a known name, which is why `smoke:real` never drives auto-register.
- Alias versus `hostName`, and why two projects sharing one build are no conflict: [`marketplace-identity-is-name-plus-plugins.md`](internal/decisions/marketplace-identity-is-name-plus-plugins.md).
- `pnpm smoke` shares one relocated `$HOME` while `new_project()` spins a fresh directory per cell; several cells auto-register from different paths. Identity by name plus plugin set is what makes that pass.
