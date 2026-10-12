# Review: Cook recipes, PR #521

- **Verdict**: approved locally; remote delivery pending
- **Diff**: `4919f04690350cb02d5f24e186137e04c8e6172e` to the working tree based on `476678cdbd6d932412e47470de0824cc656161d0`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_05
- **Findings**: 0 critical, 0 warning, 0 minor in the reviewed scope

## Phases

### Phase 1: Recipe authoring

- [x] Preserve the readable English Markdown scaffold and optional sections; no template edits in this follow-up: `plugins/aidd-context/skills/12-cook/assets/recipe-template.md`.
- [x] Keep nine concise contract principles without extra scaffolding; no contract edits in this follow-up: `plugins/aidd-context/skills/12-cook/references/recipe-contract.md`.
- [x] Preserve standalone and repair routes, the generator's `Action | Does` table with bare slugs, and action test cases: `plugins/aidd-context/skills/12-cook/SKILL.md`, `plugins/aidd-context/skills/12-cook/actions/05-validate.md`.

### Phase 2: Reliable validation

- [x] Read and inspect the same file descriptor, close it, and report read failures: `cli/src/contexts/framework/infrastructure/recipe-files-adapter.ts`.
- [x] Expose validation through standard CLI wiring instead of a skill-owned script; stop when the CLI is absent or unsupported: `cli/src/presentation/commands/framework.ts`, `plugins/aidd-context/skills/12-cook/actions/05-validate.md`.
- [x] Accept useful descriptions without guessing sentence boundaries: `cli/src/contexts/framework/domain/recipes/recipe-validation.ts`.
- [x] Reject invalid published JSON examples without altering fenced bodies: recipe integration and built-command regression tests.
- [x] Validate visible links without rejecting hidden author notes: comment-aware link regression test.
- [x] Resolve Markdown anchors from visible linked heading text: linked-heading regression test.
- [x] Reject instructional placeholders while permitting real language syntax: every multiword placeholder from the unchanged template checked in eight languages; positive JSX, C include, and Java generic tests.

### Phase 3: Usable bundled guides

- [x] Qualify savings and interface recommendations instead of presenting guarantees: `plugins/aidd-context/skills/12-cook/assets/recipes/token-optimization.md`, `plugins/aidd-context/skills/12-cook/assets/recipes/mcp-installation.md`.
- [x] Remove published references to the deleted project/shipping guides: `README.md`, `docs/CATALOG.md`, `plugins/aidd-context/README.md`, `plugins/aidd-context/CATALOG.md`.
- [x] Distinguish Claude metrics from Codex logs and warn about sensitive tool snippets despite prompt redaction: `token-optimization.md`.
- [x] Include restart and explicit Claude output-style selection: `token-optimization.md`.
- [x] Keep installation examples usable; separate and label optional rollback and teardown: `mcp-installation.md`.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | No actionable findings remain in scope. | - |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 15/15 acceptance criteria checked; criterion coverage, not an absolute quality guarantee |
| Scope | Full PR reviewed previously; unchanged material re-traced, and the complete follow-up implementation, tests, CLI wiring, skill delegation, recipes, and CI prerequisites reviewed |
| Root suite | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`: 549 passed, 0 failed; Git-hook guard passed |
| CLI suite and coverage | `pnpm --dir cli exec vitest run --coverage` with a JSON reporter: 6,833 passed, 0 failed, 1 skipped; coverage thresholds passed, 99.15% statements and 96.98% branches |
| Regression evidence | Four original validator counterexamples failed before their fixes. The later template-vocabulary regression also failed before its fix. The six built-command tests failed with the command deliberately unwired, then passed after restoration |
| Guard evidence | Removed tracked files no longer break the text-source guard; an in-memory injected NUL still makes it fail. Sandbox tests execute Node by absolute path without weakening AI-tool filtering |
| CLI gates | Typecheck, lint, architecture tests, knip, help golden, type-honesty, and duplication checks passed. Lint retains one pre-existing unrelated unused-member warning in `uninstall-use-case.ts` |
| Built CLI smoke | `AIDD_SKIP_UPDATE_CHECK=1 bash cli/scripts/smoke-tools.sh`: 137 passed, 0 failed, remote-fetch case skipped; all 34/34 leaf commands exercised, including recipe validation. Temporary home and Codex profile isolated native host changes |
| Architecture | Pure domain, application port, filesystem adapter, composition-root wiring, no copied validator in the skill, no new runtime dependency |
| Fresh dependency/build check | Isolated CLI copy without `node_modules`: `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm build`, both exited 0. The Validate workflow now provisions these dependencies before hooks and caches both lockfiles |
| Bundled recipes | Built CLI validation with `--all --bundled plugins/aidd-context/skills/12-cook/assets/recipes`: `PASS: 3 recipe(s) validated.` |
| Bundle | 743.3 KB measured; deliberate budget 744 KB, documented in `cli/scripts/check-bundle-size.mjs`; size guard passed |
| Independent review | Recipe checker closed all three guide findings. Validator checker closed the original regressions and architecture finding, then rechecked and closed the CI-prerequisite and template-vocabulary findings |
| Local delivery | Uncommitted working-tree changes only; no commit, push, GitHub review/thread mutation, or merge |
| Remote boundary | Final `gh pr view 521` confirms remote head `476678cd`, `MERGEABLE` but `BLOCKED` and `REVIEW_REQUIRED`. Existing CI belongs to that head, not these local corrections. Commit/push, new required CI results, and human approval must precede merge |
| Limits | Linux CI was not executed locally. Native recipe installations, authentication/removal, and AI-client UI workflows were not exercised; non-JSON snippet validation and editorial quality still require the skill's semantic pass |
