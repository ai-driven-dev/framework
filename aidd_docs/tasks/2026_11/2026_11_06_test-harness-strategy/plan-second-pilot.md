---
objective: "The tool profiles of `cli/src/contexts/tools` are registered once, from one list, and proven by one conformance suite every registered profile runs; their tests are rewritten to the target strategy through a recorded test challenge pass; the per-profile mutation scopes are merged into `tools`; the slice's rules are in force with a planted tree each; and the before and after measures, under the revised criteria fixed below, decide go or no-go for stage C, with no product behaviour changed."
status: pending
---

# Plan: stage B, second pilot, the tool profiles of `tools`

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Validate the model as revised after the `auth` pilot on a profile-heavy, bounded slice of `tools`: one registration list, a catalog built from it, a conformance suite every profile inherits, a kit, the per-tool tests challenged, the per-profile mutation scopes merged, and a measured verdict on the revised criteria before stage C. |
| **Source** | Text request (second pilot), grounded in `plan-pilot-auth.md` ("Verdict", "Appendix B", "After the verdict"); `cli/.claude/rules/cli-contexts/reference-context.md` (provisional, followed strictly); `target/00-overview.md` sections 3, 4, 8, 10 to 12, 14, 15; `target/04-tools-and-translate.md`; `target/07-test-architecture.md` sections 2.5, 3, 6 and 9; the tools rows of `target/code-map/`. Read on branch `refactor/second-pilot`, on top of the auth pilot. The code wins wherever a target document disagrees with it. |

Conventions of this plan:

- Paths are relative to the repository root unless they follow a `cd cli`. `target/*` line references are to `aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/target/`; `ref:N` is line N of `cli/.claude/rules/cli-contexts/reference-context.md`.
- `$B` is the baseline directory and `$SBX` the sandbox; each phase starts with:

  ```sh
  B="${TMPDIR:-/tmp}/aidd-second-pilot-baseline"; mkdir -p "$B"
  SBX="$(mktemp -d "${TMPDIR:-/tmp}/aidd-second-pilot-XXXX")"; mkdir -p "$SBX/home" "$SBX/cfg"
  sbx() { env -u AIDD_TOKEN -u GH_TOKEN -u GITHUB_TOKEN HOME="$SBX/home" AIDD_USER_CONFIG_DIR="$SBX/cfg" "$@"; }
  ```

- Safety, every phase: no `aidd`, no `node dist/cli.js`, no `pnpm smoke`, no `scripts/smoke-*.sh` by hand (`scripts/smoke-tools.sh:158` reads `gh auth token` from the real home). Every vitest and stryker run goes through `sbx`. A copy of the repository is made only with the procedure of "The representative change".
- `size_check` is the function of `plan-pilot-auth.md` "Conventions" (the code-size rules of `chore/code-size-rules`, applied in a temp copy); expected output on every file this plan writes under `src/`: nothing.
- Nothing is committed by this plan. Each phase ends green, in the order the migration rules require (`target/00-overview.md:170`): behaviour frozen first, seams, move, rename, logic.

## Step 1: choosing the context

Measured on this branch, in a sandbox, during planning (`$B` of the planning run; `sbx` as above). Test times are one sandboxed run each and were taken while other measurements ran: they rank, they do not compare; phase 1 re-takes three quiet runs for the chosen slice. Every figure of this section and of "Measured baseline" is a planning figure, superseded by `$B/baseline.txt`; file and line counts were re-checked against the tree this plan is read on, test counts and times were not.

### Measured comparison

| Measure | `tools`, whole | Profile slice (chosen) | `translate` | `distribution` |
| --- | --- | --- | --- | --- |
| Source files and lines | 83 files, 6,955 (domain 77 / 6,265, of which profiles 41 / 3,176; infrastructure 6 / 690) | 41 profile files 3,176 (7 `profiles/<tool>/hooks.ts` added, 4 `profiles/{claude,codex,copilot,cursor}/hooks-format.ts` deleted) + `registry.ts` 235 + `kernel/tool.ts` 41 + `runtime/assets/asset-loader.ts` 82 + 24 import lines in 3 wiring files; 14 files touched | 16 files, 1,661 | 22 files, 1,431 |
| Against auth (421 source lines) | 16x | 8x owned, 14 files touched | 3.9x | 3.4x |
| Test files and lines | 98 test files + 1 helper, 11,961 | 76 test files, 6,822, + helper `agent-fixture.ts` 38 | 18 files, 5,134 | 20 files, 3,128 |
| Tests and time (`sbx npx vitest run <set> --reporter=json`) | 1,047 tests, 1.12 to 1.14 s | 583 tests, 4.2 to 4.9 s (three runs under load) | 362 tests, 1.56 to 1.57 s | 209 tests, 0.83 to 2.56 s |
| Importers outside the context (`src`) | 78 files (framework 57, translate 11, presentation 5, runtime 5); 140 test files outside `tests/contexts/tools` | `registry.js` 55 `src` files, 86 test files; side-effect profile imports in 108 files (3 `src`, 105 tests) | 28 (framework 26) | 33 (framework 25) |
| Mutation scopes, CI job-seconds on the last two weekly runs on `main`, not this branch (`gh run list --workflow cli-ci.yml --event schedule --limit 2`, then `gh run view <run> --json jobs`) | `tools` 4 shards 1,351 / 1,542 s, widest shard 545 / 471 s; 6 per-profile scopes 1,630 / 2,817 s (claude 244 / 446, codex 2 shards 360 / 660, copilot 196 / 534, cursor 231 / 312, kilo 258 / 339, opencode 341 / 526); 11 jobs; total 2,981 / 4,359 s | the 7 per-profile scopes and the `tools` share they merge into; `tools-antigravity` is not on `main` yet (the commit that added Antigravity, `git log -S'tools-antigravity' --format=%h -- cli/mutation-scopes.json`, is no ancestor of the runs' head) and ran locally: 157 mutants, 85.4 (floor 82), 32 s, 33 static mutants (21 %) estimated at 90 % of the time | 2 shards 729 / 897 s | 1 job 193 / 281 s |
| Widest constructor | 2 (`NativePluginCliAdapter`); `PluginsCapability` takes one params object of more than 25 fields (`target/04-tools-and-translate.md:36`) | none (profiles are objects) | 8 (`FlatBuildStrategy`, `flat-build-strategy.ts:23-31`), 5 (`MarketplaceBuildStrategy`, `FrameworkBuildUseCase`) | 5 (`MarketplaceAddUseCase`, `MarketplaceRefreshUseCase`) |
| Representative change | add a tool, measured: see below | same as `tools` | a canon content rule on both paths, measured: 5 source files (1 new) in `translate`, 5 test files (1 new), 0 snapshots, 0 docs; one shared function called from 5 sites in 4 files | a ref pin `owner/repo#ref` for a remote marketplace, measured: 0 files in `distribution` (the parser is `kernel/source.ts`), 2 source (`kernel/source.ts`, `kernel/errors.ts`), 1 test, 1 doc (`cli/README.md`) |

The add-a-tool change, measured in a throwaway copy (procedure under "The representative change"), touched 40 files by name (the measuring run's own headline said 38; the named list below is the one used, and phase 1 re-counts it): 7 source outside the profile, 3 source inside it, 17 CLI test files (2 new, 7 with a real edit, 8 with an import line only), 1 repository scripts test, 4 snapshots, 2 config and scripts, 6 documents (2 of them generated). Counted apart, the same way before and after, because `target/00-overview.md:230` puts both out of this work's scope: the repository scripts test (`scripts/__tests__/smoke-real-user-scope-tool-list-parity.test.js`, a hand list), and the 11 files under `plugins/**` that name `antigravity` and would need the new tool (product content).

### What each candidate would prove of the auth pilot's not-proven list

The list is `target/00-overview.md:195` and `plan-pilot-auth.md` "Verdict".

| Not proven by auth | `tools`, whole | Profile slice | `translate` | `distribution` |
| --- | --- | --- | --- | --- |
| Tool profiles | yes | yes | read only | no |
| Conformance suite, "a new tool adds no test file" (`target/00-overview.md:119,140`) | yes | yes | no | no |
| Single registration (`target/04-tools-and-translate.md:51,299`) | yes | yes | no | no |
| Mutation sharding cost (per-profile scopes disappear, `target/07-test-architecture.md:253`) | yes | yes | partly (2 shards) | no |
| Behaviour tests against kit and contract suites, revised criterion 1 | yes | yes, at scale: 44 parallel per-tool files, 2,063 lines | weakly | weakly |
| Aggregate with behaviour | no (profiles are data, `target/04-tools-and-translate.md:56`) | no | no | yes (`Marketplace`, private constructor, `marketplace.ts:43`) |
| Shared forge port | no | no | no | partly (`github-raw-fetcher-adapter.ts`, `distribution -> auth`) |
| Repository with versions | no | no | no | no |
| Wide constructors | no | no | yes (8) | at the cap (5) |
| Translation, golden cost | no | no | yes (form 1, golden 64 s) | no |

### Choice: the profile slice

Chosen: the tool profiles of `tools`, with their registration, their catalog, the conformance suite, the per-tool tests and the per-profile mutation scopes. Why:

- It is profile-heavy, the condition the user set for the second pilot (`plan-pilot-auth.md` "After the verdict"; `target/00-overview.md:195,201`).
- It tests the claims the model makes hardest and the revised criterion 1 at its widest: the target's main lever here is moving cases from 44 per-tool files into a conformance suite and a kit, which is exactly the move the revised count sets apart (`target/07-test-architecture.md:176-183`).
- Its representative change is the one the overview names as the model's promise, "one profile file and one line in the registration list" (`target/00-overview.md:115`), against a measured 40 files today.
- It is bounded: 14 source files touched, the per-tool test set of 76 files, and a slice is what the target itself prescribes ("migrate one profile then the others", `target/07-test-architecture.md:341`; "to measure on the first migrated profile", `:183`).

Not picked:

- `tools`, whole: 16x auth's source, 78 importers in `src` and 140 test files outside it, and half of it (6 infrastructure files, 4 ports, the native-activation and marketplace-settings types) moves to a `host-registration` context that does not exist yet (`target/04-tools-and-translate.md:13,95,131-135,143`). Not bounded.
- `translate`: not profile-heavy (it reads profiles), and its target is form 1 and the in-memory golden, both deferred to stage D "until the pilot data exists" (`target/00-overview.md:205`); a translate pilot would execute a deferred decision. Its measured change already costs few files (the rule went through one shared function), so it would discriminate little on criterion 2.
- `distribution`: fails the profile-heavy condition by construction, and its representative change did not even reach the context (the source shorthand is parsed in `kernel/source.ts`). It is the control: it would prove the aggregate and the forge port, which stay on the not-proven list.

What this pilot still cannot prove, stated so a green verdict is not over-read: `tools` owns no command and no adapter at target (`target/04-tools-and-translate.md:93,96`), so the command template (`ref:45-70`) and the port contract-suite template (`ref:101-107`) go unexercised; no aggregate with behaviour, no shared forge port, no repository with versions, no wide constructor, no translation engine. Those stay with stage C's first contexts (`update`, `distribution`) and stage D.

## Scope of the slice

In:

- `src/contexts/tools/domain/registry.ts`, the 8 `src/contexts/tools/domain/profiles/<tool>/profile.ts` (their registration line only), a new registration list, `src/runtime/assets/asset-loader.ts`, the profile imports of `src/runtime/wiring/{tools,framework,translate}.ts`.
- The 76 test files of the slice: `tests/contexts/tools/domain/profiles/**` (67 files and `agent-fixture.ts`), the 8 root files `tests/contexts/tools/domain/{build-hooks-support-declaration,host-ref-in-use,plugin-enablement-is-machine-global,plugin-root-token-declaration,registry-conformance,registry,tool-config}.unit.test.ts` and `tool-support-surface.integration.test.ts`, and `tests/kernel/tool.unit.test.ts`. The list is `$B/slice-tests.txt`.
- The side-effect profile imports in 105 test files outside the slice (one line each, deleted).
- The 7 per-profile mutation scopes and the `tools` scope.
- The hooks capability source: the 7 `profiles/<tool>/hooks.ts`, `domain/formats/hooks-descriptor.ts` (313 lines), `domain/formats/hooks-merge.ts` (208), `domain/formats/plugin-hooks-shape.ts` (53), `domain/capabilities/hooks-capability.ts` (38), `profiles/antigravity/antigravity-hooks.ts` (115), `profiles/kilo/kilo-hooks-bridge.ts` (199), `profiles/opencode/opencode-hooks-bridge.ts` (259). Read-only data checked by conformance: `assets/hooks-runtime/host-{antigravity,bridge,claude,codex,copilot,cursor}.cjs`.
- The hooks tests: `tests/contexts/tools/hooks-descriptor-contract.integration.test.ts` (65), `domain/formats/hooks-descriptor.unit` (374), `hooks-merge.unit` (381), `plugin-hooks-shape.unit` (32), `domain/capabilities/hooks-capability.unit` (90), `profiles/{claude,copilot,cursor}/hooks.unit` (34, 21, 58), `profiles/codex/hooks.integration` (78), `profiles/antigravity/antigravity-memory-hook.integration` (113). They count in the behaviour bucket. `hooks-merge-routes.integration` (241), `hooks-routes.integration` (398, with 49 fixtures under `tests/fixtures/hooks-routes/`), `hooks-runtime.integration` (783) and `hooks-runtime-bridges.integration` (417) are context only, outside the behaviour bucket; they are listed under "Files that name paths" and nowhere else.
- The CLI hooks capability: the per-tool events a host fires, held as data on one value with invariants enforced at construction, and a hooks conformance suite. Refactor only: the emitted files are byte-identical, held by `hooks-routes.integration` and its fixtures. The event fact has three homes today: the descriptor `eventMap` (cursor and antigravity only, the rest identity); names hard-coded in `kilo-hooks-bridge.ts:23-25,130,134,159,185` and `opencode-hooks-bridge.ts:42-44,112,117,188,208`; the `EVENTS` tables of `host-bridge.cjs:13-15`, `host-copilot.cjs:13-15`, `host-cursor.cjs:14-16` and `host-antigravity.cjs:8,36`.

Out, as scope limits and not exceptions (no line of these files changes):

| Out | Why | Where it goes |
| --- | --- | --- |
| The 6 infrastructure files, 4 native ports, `marketplace-settings.ts`, `marketplace-source-conflict.ts`, `host-plugin-registration.ts`, the native-activation part of `plugins-capability.ts` | they belong to `host-registration`, which does not exist (`target/04-tools-and-translate.md:13,95,131-135,143`) | the `host-registration` PR of stage C |
| `build.ts` path functions turned into templates and data (`target/04-tools-and-translate.md:61,137-138`) | listed under form 1's "what moves where" (`target/04-tools-and-translate.md:219`), deferred by `target/00-overview.md:205` | stage D |
| The two hooks bridges merged into `event-bridge` (`target/04-tools-and-translate.md:139,293`) | a source change of its own; `target/07-test-architecture.md:183` leaves the bridge tests to document 04, not to the conformance suite | its own PR |
| The OpenCode V2 plugin API; the "changed files this turn" runtime helper (plugin side); the open event-relay changes | behaviour changes or a plugin-side concern, never inside a refactor (`target/00-overview.md:170`) | their own PRs |
| Invariants I4, I5, I7, I8, I10 (`target/04-tools-and-translate.md:78-84`) | they need a translation output to check, which is the engine of form 1 | stage D; see A7 |
| The 809-line `flat-build-strategy.integration.test.ts` (`test-file-size.arch.test.ts:28` BASELINE), under `tests/contexts/translate/` | `translate`'s own file; if phase 6's `HooksMergeRequest` edits it, the pilot must at least not grow it | `translate`'s own PR: about 9 cases go to the existing `.agent-path.integration` (127 lines) and `.plugin-root.integration` (122) split files |
| The bug found while measuring: `SkillsCapability` in `agentsSkillsDirectory` mode hard-wires `.agents/skills/` in `accepts()` (`skills-capability.ts`), true for antigravity only because its directory is `.agents/` | a behaviour change, never inside a refactor (`target/00-overview.md:170`) | its own `fix/` PR; conformance case K3 does not catch it: codex also installs skills to `.agents/skills/`, so the hard-wire holds there, and skills and mcp paths are outside K3 |

## Measured baseline

Measured during planning, as a planning figure. Phase 1 writes `$B/baseline.txt` (every row of this table) and `$B/zeta-before.txt`, then `$B/thresholds.txt` computed by the formulas in "Before and after, and go or no-go". The SHA-256 of all three is pasted into this section in the phase 1 commit. No later phase re-measures the before side. A different figure found later is reported as a finding and does not replace a number.

Phase 1 capture, frozen:

```text
53f0a26a05e1e90ed5270364d443e065800905051d30724ef0d243e1c3ea99df  baseline.txt
7b7642a0abb6100d0f8f5266e6ba2e0ba68ceae97bf61260dc5af5ed0801dd34  zeta-before.txt
3eb383928e0af3ffa42e962166ceb173b011bb8da509b397df5f31d78d61eae3  thresholds.txt
```

| Gate input | Phase 1 value |
| --- | --- |
| B1 behaviour test lines | 6,414 |
| T1 total test lines | 6,860 |
| B2 files outside the profile to add `zeta` | 25 (8 code, 17 test) |
| R import-only test files | 7 |
| D1 docs | 5 |
| C2(b) ceiling, B2 minus R | 18 |
| C3 before | 3 exceptions, 10 ambiguities |

Findings of phase 1, reported and not replacing a number:

- `tools` mutation scores 93.9 against its declared floor of 94 on the tree before the pilot; phase 8 sets the merged floor.
- Step 9's grep misses `hooks-descriptor-contract.integration.test.ts`, which builds the profile path with `join`; `$B/profile-dynamic-files.txt` lists it.
- The `zeta` copy needed two helpers in `hooks-descriptor.ts` (`noHooksSupport`, `noHooksArtifact`), an edit of `flat-build-strategy.agent-path.integration.test.ts`, and 7 generated fixtures; all counted in B2 or reported apart.
- Not re-measured, planning figures stand as reported-only rows: CI mutation job-seconds and the eager-registration probe.

| Measure | Value | Command |
| --- | --- | --- |
| Slice source | 41 profile files, 3,176 lines (7 `profiles/<tool>/hooks.ts` added, 4 `hooks-format.ts` deleted); `registry.ts` 235; `contracts.ts` 87 and `build-contract.ts` 182 (read, not changed); `kernel/tool.ts` 41; `asset-loader.ts` 82; 24 profile import lines in the 3 wiring files | `find ... \| xargs wc -l` |
| Slice tests | 76 files, 6,822 lines, plus `agent-fixture.ts` 38. Of the 67 profile test files (5,864 lines): 44 per-tool parallel files, 2,063 lines, 254 `it` (34 of 60 lines or fewer: 1,034 lines, 133 `it`; 10 longer: 1,029 lines, 121 `it`); 5 hooks files, 304 lines; 7 `build.unit` files, 1,836 lines; 11 others, 1,661 lines (bridges 955) | `wc -l`, `$B/profile-tests.tsv` |
| Buckets, fixed below | behaviour 6,414; kit 38 (`agent-fixture.ts`); contract and conformance 320 (`registry-conformance.unit.test.ts`, a `describe.each` over the registered tools); data snapshot 88 (`tool-support-surface.integration.test.ts`; its JSON, 153 lines, reported apart); total 6,860 | same |
| Tests and time | 583 tests in 72 files (planning tree, not re-run), all passed; 4,202 to 4,864 ms (three runs, under load) | `sbx npx vitest run $(cat "$B/slice-tests.txt") --reporter=json --outputFile="$B/slice-<n>.json"` |
| Assertions | 583 of 583 | same, `--expect.requireAssertions` |
| Pre-filter: duplication | 38 exact clones, 562 duplicated lines (8.58 %) | `npx jscpd --min-lines 5 --reporters console --silent $(cat "$B/slice-tests.txt")` |
| Pre-filter: duplicate titles | 31 titles in two files or more (77 occurrences), 10 of them in three files or more (the conformance candidates of `target/07-test-architecture.md:180`), in `$B/dup-titles.txt` | title scan, node one-liner over `$B/slice-tests.txt` |
| Pre-filter: unique coverage per file | phase 1, leave-one-out over the 76 files | `ref:121` |
| Mutation, CI | see "Measured comparison"; the 8 scopes of the tools family, 12 jobs counted with `tools-antigravity` | `gh run view <id> --json jobs` |
| Mutation, local, before | `tools-antigravity` 32 s, 85.4; the other 7 scopes in phase 1 | `sbx node scripts/run-mutation.mjs <scope> --force` |
| Registration sites | `registerTool` at the bottom of each `profile.ts` (8); side-effect imports of profiles in 108 files (7 import all 8, 34 import 2, 33 import 1, 34 import 3 to 7); `AI_TOOL_IDS` and the union in `kernel/tool.ts:3-28`; `CONFIG_ASSETS` keyed by every `ToolId` (`asset-loader.ts:28-35`, `antigravity: {}` required) | `grep` |
| Overrides of the global registry in tests | `registerTool` called by 6 test files: `registry.unit`, `tool-config.unit`, and 4 framework tests (`install-runtime-config-use-case.unit:351-361`, `install-ide-tool-use-case.unit:166-170`, `install-scope.unit:68-78`, `setup-flow.unit:127-133`) | `grep -rn registerTool tests` |
| Eager registration, probed | in a throwaway copy, `registerTool` removed from the 8 profiles and the registry built from one list in today's order: 7,058 unit, integration, contract and architecture tests, 3 failures: `tool-addition-cost.arch` (the list names tools), `setup-wiring.integration:368` (it registered 6 of 8 profiles and pinned the help of that partial world), and the copy-only `in-process-cli.integration` failure | copy deleted after |
| Consumers of the registration order | `init-use-case.ts:52` and `doctor-layout-use-case.ts:31` iterate `getAllRegisteredTools()`; `setup.ts:105` sorts; `distributionProbesOf` sorts by depth. Today's order is the import order of `runtime/wiring/framework.ts:2-10`: antigravity, claude, codex, copilot, cursor, kilo, opencode, vscode | reading |

### The representative change

Definition, the same text before and after, naming no path because the slice changes where registration lives: a new AI tool `zeta`, display name `Zeta CLI`, project directory `.zeta/`, flat mode, skills only (no agents, commands, rules, hooks, MCP, native registration or config assets; having no hooks, no hooks descriptor, `hooks.ts` or payload fixture enters the count of C2), skills under `.zeta/skills/aidd-<name>/SKILL.md`; selectable by `aidd setup --ai zeta` and the menu, buildable by `aidd translate --to zeta`; goldens regenerated by their own update variables and their diff read; one test per new behaviour the conventions require; every document that lists the supported tools updated; the whole `cli` suite, the typecheck, the lint and the repository scripts suite green in the copy. Skills only, because it isolates the fixed cost of registering a tool, which is what the model claims to remove (`target/00-overview.md:115`, `target/04-tools-and-translate.md:299`); a feature-rich tool adds its own work equally before and after.

Procedure (the copy holds the whole tree: the goldens read `plugins/` and `.claude-plugin/` through `REPOSITORY_ROOT`):

```sh
R="$(git rev-parse --show-toplevel)"
M="$(mktemp -d "${TMPDIR:-/tmp}/aidd-p2-tool-XXXX")"
rsync -a --exclude node_modules --exclude .git --exclude dist --exclude reports --exclude .e2e-build --exclude .stryker-tmp "$R/" "$M/"
ln -s "$R/cli/node_modules" "$M/cli/node_modules"; [ -d "$R/node_modules" ] && ln -s "$R/node_modules" "$M/node_modules"
git -C "$M" init -q && git -C "$M" add -A && git -C "$M" -c user.name=m -c user.email=m@m commit -qm base
(cd "$M/cli" && sbx npx vitest run)   # baseline of the copy; tests/helpers/in-process-cli.integration.test.ts fails in a copy, before and after
# implement zeta by the definition, then:
(cd "$M/cli" && sbx npx vitest run && pnpm typecheck && pnpm lint)
(cd "$M" && node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js')
git -C "$M" status --porcelain | tee "$B/zeta-<before|after>.txt"
rm -rf "$M"
```

Buckets, counted apart: (a) source outside the profile directory; (b) source inside it; (c) test files, new ones named; (d) snapshots; (e) config and scripts; (f) documents; plus the `plugins/**` count.

Before, measured:

| Bucket | Files |
| --- | --- |
| (a) 7 | `kernel/tool.ts` (union and array), `presentation/commands/translate.ts:75` and `presentation/prompts/menu-use-case.ts:48,69` (help strings that list the tools), `runtime/assets/asset-loader.ts` (`zeta: {}` to compile), `runtime/wiring/{framework,tools,translate}.ts` (one side-effect import each) |
| (b) 3 | `zeta/profile.ts` 50, `zeta/build.ts` 32, `zeta/zeta-paths.ts` 5 |
| (c) 17, plus 1 apart | new: `profiles/zeta/profile.unit.test.ts`, `profiles/zeta/build.unit.test.ts`; real edits: `architecture/tool-addition-cost.arch` (6 BASELINE counts), `golden/framework-build-golden.golden` (`FLAT_TARGETS`, the "11 cells" strings), `tools/domain/tool-config.unit` and `framework/application/uninstall-use-case.unit` (they pin the whole id list or the error naming it), `tools/domain/registry-conformance.unit` (two hand tables), `presentation/commands/translate-wiring.integration` and `presentation/prompts/interactive-menu-use-case.unit` (they pin the help strings); apart: `scripts/__tests__/smoke-real-user-scope-tool-list-parity.test.js`; an import line only, because the test registers profiles by hand and `AI_TOOL_IDS` then names an unregistered tool: `clean-native-cache.integration`, `project-hooks-materializer.unit`, `list-installed-rules-use-case.unit`, `plugin-asset-translation.integration`, `plugin-root-token-declaration.unit`, `tool-support-surface.integration`, `host-marketplace-registry-reader-adapter.integration`, `helpers/ports/build-unit-deps.ts` |
| (d) 4 | `framework-build/golden.json` +184, `tool-support/surface.json` +17, `help/surface.json`, `phase0/snapshot.json` |
| (e) 2 | `.github/workflows/ci.yml` (`build-per-tool` matrix), `cli/scripts/smoke-tools.sh` (`AI_TOOLS`); left out by the measuring run and counted here as debt of today: a `tools-zeta` scope and script, and the bundle budget, 2 to 3 more |
| (f) 6 | `README.md` and `docs/COMPATIBILITY.md` (generated from the tool-support snapshot by `scripts/sync-generated-docs.mjs`), `cli/README.md`, `docs/INSTALL.md`, `cli/aidd_docs/memory/codebase-map.md`; nothing under `cli/.claude/` |

Cross-check against history: the commit that added Antigravity (found by the `git log -S` above) touched 47 files: 6 task documents, 1 memory page, 3 config (`ci.yml`, `mutation-scopes.json`, `package.json`), 2 scripts, 13 source (10 outside the profile, 3 inside), 19 test files, 3 snapshots. The 3 extra source files there (`plugins-capability.ts`, `content-translator.ts`, `built-tree-materialization-translator.ts`) carried Antigravity's flat skill layout, a feature, not registration: the skills-only definition is right to leave them out.

After, predicted file by file from the design below (phase 11 measures it; the prediction is what the threshold is fixed on):

| Bucket | Files | Why it still changes |
| --- | --- | --- |
| (a) 4 | `contexts/tools/domain/profiles/registered-profiles.ts` (one line), `kernel/tool.ts` (M-T1), `presentation/commands/translate.ts`, `presentation/prompts/menu-use-case.ts` | the list; the union until `kernel` moves; the two help strings, frozen surface |
| (b) 3 | the profile's own files | the tool |
| (c) 3, plus 1 apart | `architecture/tool-addition-cost.arch` (the two help-string files stay in its BASELINE, and "holds each admitted file to the number of tools its reason was written around" makes their `named` count go up), `presentation/commands/translate-wiring.integration`, `presentation/prompts/interactive-menu-use-case.unit` (they pin the frozen strings, at a lower level than the help golden, so A8 keeps them); apart: the scripts parity test | no new test file: conformance covers the profile, including its build-contract paths (K3) |
| (d) 4 | the same four snapshots | data, read by a human |
| (e) 2 | `ci.yml` matrix, `smoke-tools.sh` (out of scope, `target/00-overview.md:230`); no mutation scope or script (RT5) | reported |
| (f) 6 | the same documents; 2 generated | reader-facing lists |

Gone, against before: the 3 wiring files, `asset-loader.ts`, the 8 import-only tests, `tool-config.unit`, `uninstall-use-case.unit`, `registry-conformance.unit` (into conformance, which reads the profile), `framework-build-golden.golden` (targets and cell counts derived from the catalog), and the 2 new per-tool test files.

## Target, file by file

### Source

Path under `cli/src/`.

| Current | Action | Target | DDD element | Phase |
| --- | --- | --- | --- | --- |
| (new) | add | `contexts/tools/domain/profiles/registered-profiles.ts`: `REGISTERED_PROFILES`, one line per tool, in today's order (antigravity, claude, codex, copilot, cursor, kilo, opencode, vscode) | the single registration list (`target/04-tools-and-translate.md:299`); placement by A1 | 3 |
| `contexts/tools/domain/registry.ts` | split in place | `createToolCatalog(profiles)`, a built value over a list (the read side and its derivations, pure); the module's free functions read one catalog built once from `REGISTERED_PROFILES`; `registerTool` becomes the override of that catalog the 6 testing files use, documented as such (E-T1); the global `Map` filled by side effect goes | catalog, a domain service over the profiles (`target/04-tools-and-translate.md:125`) | 3, 6 |
| `contexts/tools/domain/profiles/<tool>/profile.ts` (8) | edit | the `registerTool` import and call removed (2 lines each) | profile, a value object: data and named behaviours | 3 |
| `contexts/tools/domain/profiles/vscode/profile.ts` | rename | export `vscodeToolConfig` to `vscode`, like the seven others (3 importers) | profile | 5 |
| `runtime/wiring/{tools,framework,translate}.ts` | edit | the 8 side-effect profile imports of each removed | composition root (M4 of the reference) | 3 |
| `runtime/assets/asset-loader.ts` | edit | `CONFIG_ASSETS` becomes a partial map read with an empty default, so a tool without assets has no line (`target/04-tools-and-translate.md:39,299`); `antigravity: {}` removed | infrastructure, asset provider | 6 |
| `contexts/tools/domain/formats/hooks-descriptor.ts` | rewrite | `HooksDescriptor` becomes a class (or a `parseHooksDescriptor` factory returning a branded value) holding `events: ReadonlyMap<CanonicalEvent, {native: readonly string[]; relay: "native" \| "bridge"}>`; `eventMap` a derived accessor; the bridges read their relay sets from `events`. Invariants at construction: H-I1 each key in `CANONICAL_HOOK_EVENTS`, native list non-empty and duplicate-free; H-I2 `project` requires `file`; H-I3 `loaderEntry` and `file` exclusive; H-I4 every path relative and under the tool's `directory`; H-I5 `rootToken` present exactly when `file` is; H-I6 `runtime.adapter` stamped (no `const HOST = "unstamped"` left), the stamp moving from the `.replace` in the kilo and opencode `hooks.ts` into the constructor. Behaviour stays with the value | the descriptor, a value object with its invariants (design bar) | 6 |
| `contexts/tools/domain/capabilities/hooks-capability.ts` | keep | add only `outputPath` relative (H-I4) | capability | 6 |
| `contexts/tools/domain/profiles/{kilo,opencode}/*-hooks-bridge.ts` | edit | read the relayed set from the descriptor instead of hard-coded names | profile behaviour | 6 |
| `assets/hooks-runtime/*.cjs` | keep | plain Node, out of the domain; conformance reads each `EVENTS` table as text and holds it equal to the descriptor (K11); they import nothing from the CLI (E-T3) | data read by conformance | none |
| `contexts/tools/domain/build-contract.ts:45-50` and the callers of `hooksFile.merge` | edit | the cause of five wide signatures is the type `hooksFile.merge: (existing, pluginHooks, plugin, locate) => ...`, which forces `hooks-merge.ts:65` `mergeHooks` (5 parameters), `:128` `rewriteRoot` (4), `:147` `runsPluginScript` (4), `hooks-descriptor.ts:153` and `:166-171` (4 each) and `antigravity-hooks.ts:70` `mergeAntigravityHooks` (4). New: `HooksMergeRequest {existing, pluginHooks, plugin, locate}` as a value with its own invariants, in a `formats/hooks/` subfolder (`formats/` is at its cap, RT6). `mergeHooks` takes `(request)`, `rewriteRoot(hooks, route)`, `runsPluginScript(command, route)`. Callers: `flat-build-strategy.ts:253`, `antigravity/build.ts:63`, `antigravity/profile.ts:53-54`. The 3 `!` exclusions of those files leave the biome override and the `function parameters` ceiling of `code-size.arch.test.ts` (`MAX_BASELINE`, 94) drops to the measured count (about 91), shrink-only; the `build-contract.ts` and `claude`, `codex`, `copilot`, `cursor` `build.ts` exclusions stay unless they fall out. Count before and after, recorded. These two files exist on `chore/code-size-rules`; until it is in the base, check with the temp copy of `size_check`, as the auth pilot did | the merge request, a value object | 6 |
| `contexts/tools/domain/profiles/antigravity/antigravity-hooks.ts` | edit | purity: it uses the `Buffer` global in the domain and `JSON.parse(...) as unknown` and `as ClaudeHooks`; move the parse into the existing parser `formats/plugin-hooks-shape.ts`, and replace `Buffer` with a pure base64 decode or move it out of the domain (A10) | domain purity | 6 |
| `kernel/tool.ts` | keep | the union and `AI_TOOL_IDS` stay (M-T1); the conformance suite holds them equal to the registration list (K1) | shared vocabulary | none |
| `presentation/commands/translate.ts:75`, `presentation/prompts/menu-use-case.ts:48,69` | keep | the help strings stay written out: no list order derives them byte for byte (the registration order and `AI_TOOL_IDS` order both differ from the help's), and help text is frozen surface (`target/00-overview.md:228`) | presentation | none |

Source after, registration rows: 1 file added, 13 edited, 0 moved; the hooks rows above add the `formats/hooks/` file and edit the files they name; product behaviour unchanged, held by the characterization of phase 2 and the goldens.

### Tests

Path under `cli/tests/`. Verdicts are planned; Appendix A holds one row per test, written in phases 6 and 7. "Read case by case" means each `it` is read, and goes up to the conformance suite when it is written identically in three profiles or more (`target/07-test-architecture.md:180`), becomes a row of that profile's bounded `it.each` table in `profiles/<tool>/profile.unit.test.ts` when it differs only by a datum (`:181`), and stays where it is otherwise (A6). A case is deleted only with its inverted proof (`ref:125`).

| Current | Lines / `it` | Verdict | Target | Phase |
| --- | --- | --- | --- | --- |
| `contexts/tools/domain/registry-conformance.unit.test.ts` | 320 / 21 | split: the per-tool `describe.each` (`:46-116`) and `:118-127` become the conformance suite; the two hand tables naming tools read the profile instead (`TOOLS_WITHOUT_A_NATIVE_MARKETPLACE`, the rules-directory table `:298-320`); `buildTargetModesOf` (`:166-185`) and `distributionProbesOf` (`:187-218`) move to the tests of their own source, which is `translate` (`build-target.ts:20`, `plugin-format.ts:21`); `frameworkBuildModeFor`, `machineLocalFilesOf`, `userMachineLocalFilesOf`, `projectHooksFileOf` go to the catalog test, the real-tool cases kept as rows where no other test pins the datum | `testing/profile-conformance.ts`, `domain/profiles/profile-conformance.unit.test.ts`, `contexts/translate/domain/build-target.unit.test.ts`, `contexts/translate/domain/plugin-format.unit.test.ts`, `domain/catalog.unit.test.ts` | 6 |
| `contexts/tools/domain/registry.unit.test.ts` | 172 / 8 | rewrite over a catalog of synthetic profiles from the kit instead of `registerTool` on the global | `domain/catalog.unit.test.ts` | 6 |
| `contexts/tools/domain/tool-config.unit.test.ts` | 122 / 12 | split: "contains exactly claude, cursor, ..." (`:26`) becomes K1 (ids equal to the registration list); `stripToolSuffix` (`:40-58`) to the test of its source `formats/command.ts`; `toolIdsForCategory`, `assertToolIdsMatchCategory`, the registry cases (`:103-120`) to the catalog test | conformance; `domain/formats/command.unit.test.ts`; `domain/catalog.unit.test.ts` | 6 |
| `contexts/tools/domain/build-hooks-support-declaration.unit.test.ts` | 57 / 1 | merge: a case over every flat profile, conformance K5 (code map `tests-tools-translate-distribution-runtime-kernel.md:13`) | conformance | 6 |
| `contexts/tools/domain/plugin-root-token-declaration.unit.test.ts` | 100 / 6 | split: the 4 declaration cases (`:35-82`) become K6; the 2 route cases (`:84-100`) are build behaviour and stay | conformance; same file, 2 cases | 6 |
| `contexts/tools/domain/host-ref-in-use.unit.test.ts`, `plugin-enablement-is-machine-global.unit.test.ts` | 19 / 3, 26 / 4 | merge into the catalog test: the rule over synthetic profiles, each real-tool answer kept as a row unless another test pins it (inverted proof) | `domain/catalog.unit.test.ts` | 6 |
| `contexts/tools/domain/tool-support-surface.integration.test.ts` | 88 / 1 | keep: it is the data snapshot of every profile (`target/04-tools-and-translate.md:105`), already wired to `docs/COMPATIBILITY.md`; its 8 side-effect imports go. The proposed `profile-data.golden.test.ts` (`:364`) is not added: it would duplicate this one | same | 3 |
| `contexts/tools/domain/profiles/agent-fixture.ts` | 38 | move to the kit (`target/04-tools-and-translate.md:362`) | `contexts/tools/testing/agent-fixture.ts` | 4 |
| the 34 per-tool parallel files of 60 lines or fewer: antigravity `profile` 44; claude `agents` 41, `commands` 36, `content` 16, `mcp` 29, `profile` 12, `rules` 53, `skills` 12; codex `agents` 44, `commands` 24, `content` 18, `mcp` 26, `profile` 30, `rules` 24; copilot `commands` 41, `mcp` 36, `profile` 43, `settings` 31, `skills` 11; cursor `agents` 48, `commands` 24, `content` 20, `plugins` 44, `profile` 28, `skills` 16; kilo `agents` 29; opencode `agents` 40, `commands` 30, `content` 14, `hooks` 32, `plugins` 37, `rules` 41, `skills` 18; vscode `settings` 42 | 1,034 / 133 | read case by case; a file is dropped once every case has a home (`target/07-test-architecture.md:180`) | conformance, or `profiles/<tool>/profile.unit.test.ts` | 6 |
| the 10 longer parallel files: claude `plugins` 83; codex `plugins` 62, `skills` 82; copilot `agents` 68, `content` 153, `plugins` 81, `rules` 99; cursor `rules` 69; kilo `profile` 138; opencode `mcp` 194 | 1,029 / 121 | keep, reduced to what is specific to the tool; their identical cases go up | same files | 6 |
| the 5 hooks files: claude `hooks.unit` 34, copilot `hooks.unit` 21, cursor `hooks.unit` 58, codex `hooks.integration` 78 (it replaces the deleted codex `hooks.unit`, 94), antigravity `antigravity-memory-hook.integration` 113 | 304 / counted in phase 1 | read case by case; the declaration cases go up to K9 and K10, the rest stay | conformance, or the same files | 6 |
| the 7 `profiles/<tool>/build.unit.test.ts` (antigravity 105, claude 295, codex 357, copilot 328, cursor 294, kilo 160, opencode 297) | 1,836 / 104 | keep at unit level; challenged against each other and the conformance suite only, never against the golden (A8) | same | 7 |
| the 11 other profile files: antigravity `antigravity-hook-response.integration` 98, `antigravity-hooks.unit` 181; codex `codex-agent-toml.unit` 158, `config.unit` 125, `global-files.unit` 30, `toml.unit` 42; kilo `global-files.unit` 30, `kilo-hooks-bridge.integration` 401; opencode `global-files.unit` 42, `opencode-hooks-bridge-mapping.integration` 149, `opencode-hooks-bridge.integration` 405 | 1,661 / 112 | keep; pre-filter flags only (the bridges are a scope limit); the three `global-files` files read case by case like the parallel ones | same | 7 |
| `kernel/tool.unit.test.ts` | 54 / 9 | keep (M-T1) | same | none |
| 105 test files outside the slice with side-effect profile imports | one line each | delete the line: the catalog is built from the list | same | 3 |
| `presentation/commands/setup-wiring.integration.test.ts:368` | 1 case | rewrite: it pinned the help of 6 registered profiles; the production help is the 8-profile one the help golden already holds | same | 3 |
| (new) | characterization | C1 to C3, phase 2 | see phase 2 | 2 |
| (new) | conformance | `describeProfileConformance(profile)` in the kit, one loop file over `REGISTERED_PROFILES`; adding a tool adds no test file (`target/00-overview.md:119`) | `testing/profile-conformance.ts`, `domain/profiles/profile-conformance.unit.test.ts` | 6 |
| (new) | kit | `aProfile()` builder of a synthetic profile with `with*` (`ref:98`), and `aCatalog(...profiles)` | `testing/profiles.ts` | 6 |

Conformance cases, the content fixed now (A7): K1 the id is unique, present once in the registration list, equal to its key, and the list equals `AI_TOOL_IDS` plus `IDE_TOOL_IDS` (I1); K2 every profile directory under `profiles/` is in the list ("fails if a profile is missing from registration", `target/04-tools-and-translate.md:104`), and every profile directory with `acceptsHooks` has exactly one `hooks.ts` exporting `<TOOL>_HOOKS`, and none without it (the file side of K9); K3 `directory` is relative and ends in `/`, and every path the profile computes for a sample plugin tree stays under it, on both sides: the install paths of its capabilities and the `path` of each supported artefact of each build contract (I2); K4 each artefact is either supported with a path or unsupported (I3), and the declared capabilities agree with the build contract; K5 a flat build contract's hooks support matches `acceptsHooks`; K6 the plugin root token rules (I6, declaration side); K7 the cases the pre-filter finds written identically in three profiles or more, after reading; K8 behaviour fixed by `onMultipleCandidates` for zero, one or several config candidates where a profile declares them (I9). Hooks conformance, each seen red against a broken synthetic descriptor from the kit: K9 a descriptor exists exactly when `capabilities.plugins.acceptsHooks`, exported as `<TOOL>_HOOKS` (it takes over `hooks-descriptor-contract.integration.test.ts`, deleted by proof); K10 construction refuses each of H-I1 to H-I6 (six red cases, the kit's broken-descriptor builders); K11 the declared events equal the host adapter's `EVENTS` table, and the `bridge` relay set equals what the bridge handles; K12 each declared event has a payload fixture under `scripts/__tests__/fixtures/hook-payloads/` (today one per relayed event of each tool: a holds-today case, not new coverage). Each case is seen red once against a broken synthetic profile from the kit before it is kept (`ref:107`).

## The test challenge pass

Delivered in this PR, by the template (`ref:116-127`), over the 76 files of `$B/slice-tests.txt`:

1. Pre-filter, candidates only: leave-one-out coverage of the slice sources (`src/contexts/tools/domain/profiles/**`, `registry.ts`, `kernel/tool.ts`, `asset-loader.ts`) with every file and once without each, under `bash`; `jscpd` (38 clones today); `--expect.requireAssertions` (583 of 583 today); the duplicate titles (31, 10 in three files or more).
2. An inverted proof for every deletion: the named behaviour broken by hand, another named test red, both written down. A case moved into the conformance suite is a move, not a deletion, and is proven the same way: broken on one profile, the conformance case for that profile red.
3. Appendix A: one row per test before and after (file and title, behaviour, flags, verdict, target, proof).
4. The counts per bucket: tests and lines before and after; kept, rewritten, merged into conformance, moved to the kit, deleted with their code, deleted by proof, added.

## Rules in force for this slice

Each enters with a planted tree that proves it bites (`target/00-overview.md:160`).

| Rule | Mechanism | Planted tree |
| --- | --- | --- |
| RT1 no tool id outside a profile directory and the registration list (`target/04-tools-and-translate.md:114`) | `tool-addition-cost.arch.test.ts`, `isAllowed` admits `registered-profiles.ts` and nothing else; the BASELINE only shrinks | a file outside `profiles/` naming two ids is flagged; the registration list is cleared |
| RT2 no side-effect import of a profile module | a new case in `tool-addition-cost.arch.test.ts` (the file that owns registration cost), over `src` and `tests` | a planted `import ".../profiles/claude/profile.js"` is flagged; a named import is cleared |
| RT3 every registered profile passes the conformance suite, and a profile directory outside the list fails it | the conformance loop, K2 | a synthetic profile breaking each of K1 to K12 is red; a directory missing from the list is red |
| RT4 `tools` imports no other context (`target/04-tools-and-translate.md:115`) | `ALLOWED` has no `tools->` edge (`tests/architecture/helpers.ts:118-127`), `context-graph.arch.test.ts` | already in force; its planted "tools to auth crossing" (`ref:91`) is cited, not re-planted |
| RT5 no per-profile mutation scope (`target/07-test-architecture.md:253`) | a new case in `mutation-covers-source.arch.test.ts`, "no scope mutates a single tool profile": no scope's `mutate` glob reaches under `src/contexts/tools/domain/profiles/<tool>/` without reaching the rest of `tools`. The file's existing cases check coverage, overlap, floors and scripts, and a per-profile scope with its own script passes them all today | a planted `tools-claude`-shaped scope, with the `tools` glob carving it out and its script present, is red; the merged `tools` scope is green |
| RT6 `tools/domain` holds 10 direct files, at the cap, with no BASELINE entry; `domain/formats/` also holds 10, at the cap | `folder-size.arch.test.ts` (`MAX_FILES_PER_FOLDER`) | in force; any new file (catalog, registration list, hooks-merge request) goes in a subfolder, never a direct file; the registration list sits in `profiles/`, which holds no direct file today |

Written rules no tool checks, carried from the reference: the glossary (`src/contexts/tools/glossary.md`, phase 10), a kit imported by its own context only, one subject per test file, the challenge pass.

## Files that name paths

Checklist, each moved in the phase that changes its path (`target/00-overview.md:163`, `ref:191`):

- `cli/mutation-scopes.json`: the 7 `tools-*` scopes removed, `tools.mutate` becomes `src/contexts/tools/**/*.ts`, shards from phase 8's measure; the `$comment` sentence on the per-profile split rewritten.
- `cli/package.json`: the 7 `test:mutation:tools-*` scripts removed.
- `tests/architecture/mutation-shards.arch.test.ts:31-32` (names `tools-codex`); `.github/workflows/cli-ci.yml:617` (a comment naming `tools-codex`).
- `tests/architecture/tool-addition-cost.arch.test.ts` (`isAllowed`, RT2; its `IDENTIFIER_BASELINE` lists the `formats/*` files, so any move changes its keys).
- `tests/architecture/tool-hooks-one-descriptor.arch.test.ts`, `tests/architecture/domain-does-no-io.arch.test.ts`, `tests/architecture/profile-copies.arch.test.ts` and `scripts/profile-copies.mjs` (the jscpd baseline between profiles).
- The hooks fixtures `tests/fixtures/hooks-routes/` (49 files), and, context only, `hooks-merge-routes.integration`, `hooks-routes.integration`, `hooks-runtime.integration` and `hooks-runtime-bridges.integration` under `tests/contexts/tools/`.
- `tests/architecture/helpers.ts:64` (comment: "that is how tools register themselves").
- `tests/architecture/folder-size.arch.test.ts` (unchanged, checked).
- `knip.json`: the kit lives outside `tests/helpers/**`, so knip reports an unused kit export (`ref:99`); checked green.
- `vitest.config.ts` coverage excludes and `scripts/sweep-stale-test-dirs.cjs` prefixes: checked; a new `tests/contexts/tools/testing/` folder is added to neither unless the phase 9 gate says so.
- `cli/aidd_docs/memory/testing.md:22` (the per-tool test split) and `:45` (the per-profile mutation scopes); `cli/aidd_docs/memory/codebase-map.md:143` (where a tool lives: add the registration list).
- `cli/.claude/skills/tools/SKILL.md` ("`registerTool(config)` is called once, at the bottom of `profile.ts`"; "How it's tested") and its `references/*.md` that name the registration.
- `aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/target/code-map/src-tools-translate.md:8`, `src-runtime-kernel-presentation-distribution.md:13`, `tests-tools-translate-distribution-runtime-kernel.md:9-17` and the per-tool rows: the placement A1 and A3 decide (`target/00-overview.md:254`).

## Reference deviations, listed before execution

Definitions, the reference's own (`ref:15-17`), with one addition for a slice, fixed now: a deviation counts only when a file this plan writes deviates from a cited target line; what the slice does not touch is a scope limit (section "Scope of the slice"), never an exception. A deviation forced by settling an ambiguity counts as that ambiguity, not twice. Any exception found during execution is added here, names the phase that found it and flips criterion 3 if it tips the count; only the reviewer accepts an addition.

### Exceptions

| # | Deviation | Line it deviates from | Why | Disappears when |
| --- | --- | --- | --- | --- |
| E-T1 | the catalog is built once at module load and read through free functions, not injected; `registerTool` survives as an override used by 6 test files | `target/07-test-architecture.md:172` ("tests of generic logic receive a test registry of 2 synthetic profiles"), `target/04-tools-and-translate.md:299` ("built once and injected") | 55 `src` files and 86 test files read `registry.js` (measured); injecting the catalog is the framework split's work. The catalog's own tests do use synthetic profiles | consumers receive a `ToolCatalog`: the framework split of stage C |
| E-T2 | `tools` keeps its public-surface list (`PUBLIC_MODULES.tools`, `context-boundary.arch.test.ts:11-50`), has no `contract/`, is not in `HELD_BY_BIOME`, and `registry.ts` keeps its path | `ref:87-88` (types a non-context needs live in `contract/`; the interior is closed), `target/04-tools-and-translate.md:94` (`contract/tool-catalog.ts`), code map `src-tools-translate.md:8` (`domain/catalog.ts`) | renaming the read side and closing the interior rewrites 78 `src` importers and 140 test files for no behaviour; the slice rewrites `registry.ts` but not its address | `tools` migrates whole, after `host-registration` exists |
| E-T3 | the host adapters' `EVENTS` tables stay a second written copy of the event fact, held equal to the descriptor by K11 rather than generated | the principle that one fact has one home (the design bar: a rule lives on the object that owns the data) | the `.cjs` adapters are plain Node and import nothing from the CLI | the adapter is generated at build time from the descriptor |

### Ambiguities removed

| # | Line one | Line two | Settled |
| --- | --- | --- | --- |
| A1 | `target/00-overview.md:205`: "the tool profile in `composition/tool-profiles/`" deferred to stage D until the pilot data exists | `target/04-tools-and-translate.md:69,376` ("Decided: a profile is ONE file per tool, in `composition/tool-profiles/`"), code map `src-runtime-kernel-presentation-distribution.md:13` | the overview wins (`target/04-tools-and-translate.md:5`): profiles and the list stay in `contexts/tools/domain/profiles/`. A list under `composition/` read by `registry.ts` would make a context import `composition/`, which `ref:92` forbids, unless the catalog is injected (E-T1). This pilot's criterion 2 is the data stage D waits for |
| A2 | `target/04-tools-and-translate.md:117` and code map `src-runtime-kernel-presentation-distribution.md:65`: the id union derived from the registration array (`as const`) | `target/00-overview.md:238`: `ToolId` an opaque branded string in `shared/domain`, "no compile-time union derived from `composition`" | no union derived from the list (the overview wins); the union in `kernel/tool.ts` stays until `kernel` moves to `shared` (M-T1), and K1 holds it equal to the list |
| A3 | `target/07-test-architecture.md:179`: `profile-conformance.test.ts`, no level | `target/04-tools-and-translate.md:358` and code map `tests-tools-translate-distribution-runtime-kernel.md:9`: `tests/composition/tool-profiles/profile-conformance.unit.test.ts`; `ref:103`: a suite is `*.contract.test.ts` under `ports/` | `tests/contexts/tools/domain/profiles/profile-conformance.unit.test.ts`, mirroring the list (`ref:30`), at unit level because it touches nothing but memory (`target/00-overview.md:135`); a profile is not a port, so `ports/` and `.contract` do not apply; the suite body in the kit (`ref:103`) |
| A4 | `target/04-tools-and-translate.md:350`: floors "frozen during the transition (never raised, never lowered without a written reason)" | `target/07-test-architecture.md:266` and `ref:133`: raising to the measured score stays allowed | the landed rule (`ref:133`): the merged `tools` floor is set to its measured score at migration, rounded down; the per-file scores of kilo (64) and antigravity (82) are reported from the merged run, not hidden (`target/04-tools-and-translate.md:350`, "not to be masked") |
| A5 | `target/00-overview.md:115`: a tool costs "one profile file and one line in the registration list" | `target/07-test-architecture.md:172`: "its profile file, its line in the registration list and its snapshot"; `target/04-tools-and-translate.md:299`: "plus its assets if it has any" | snapshots and assets are counted in their own buckets of criterion 2 and reported; the threshold binds code and test files |
| A6 | `target/04-tools-and-translate.md:340`: merge the parallel files "of 60 lines or fewer" | `target/07-test-architecture.md:180-181`: a case moves up when written identically in three profiles; a datum-only difference becomes a bounded `it.each` | the case rule decides; the size only orders the reading (line one itself requires "each case read before the file is dropped") |
| A7 | `target/04-tools-and-translate.md:104,342`: conformance runs I1 to I10 | `target/07-test-architecture.md:178`: the ~27 identical cases (capabilities, build contract, paths, ids, formats) | K1 to K12 above: the invariants checkable on a profile alone, plus the identical cases and the hooks cases; I4, I5, I7, I8, I10 need a translation output and stay with form 1 (scope limit) |
| A8 | `target/04-tools-and-translate.md:245,344`: reduce the `build.unit` tests to what the golden does not cover | `target/00-overview.md:134`, `ref:112`: a behaviour is tested at the lowest level that proves it | the lowest level (the overview wins): no unit case is deleted because the golden holds it; the golden is never the holder of an inverted proof |
| A9 | `target/04-tools-and-translate.md:139,293`: one shared `event-bridge` | the landed `cli/aidd_docs/memory/architecture.md` (hooks bullet): one descriptor per tool, one host adapter per tool | one descriptor per tool now; merging the bridges is its own PR (scope limit) |
| A10 | the design bar of this plan: `node:path` only | `ref:79` (reference section 4): `node:path` and `node:crypto` | the reference wins |
| A11 | K3 above: every path a profile computes for a sample plugin tree stays under `directory` | codex installs skills to `.agents/skills/`, outside `.codex/`; mcp files sit outside the directory for several tools | K3 narrowed to commands, rules, agents and flat hooks under `directory`, and every supported artefact path relative; skills and mcp paths are not asserted |
| A12 | K8 above: `onMultipleCandidates` behaviour fixed for zero, one or several config candidates | `onMultipleCandidates` and `configCandidates` exist only in `target/04-tools-and-translate.md:63,83`, nowhere in `src/` | K8 dropped: no code for an input never observed, stated as a limit |

### Migration state

Not exceptions of the model: each vanishes with an old-layout move of stage C.

| # | Deviation | Vanishes when |
| --- | --- | --- |
| M-T1 | `AiToolId` and `AI_TOOL_IDS` in `kernel/tool.ts:3-28`, where the target has an opaque `ToolId` in `shared/domain` (`target/00-overview.md:238`); adding a tool still edits it | `kernel/` moves to `shared/` |
| M4, M5 (reference) | the wiring still lives in `runtime/wiring/` | `runtime/wiring/` moves to `composition/` |
| E8 (reference) | `tools` keeps `domain/ports/` | the last context migrates |

Counted for criterion 3: 3 exceptions (E-T1 to E-T3) against 10 ambiguities (A1 to A10): go, recorded before execution. The slice definition of an exception above is this plan's addition to `ref:15-17`, open to removal by the person before phase 1, like C1b; without it, the four scope limits that are deviations (the `host-registration` elements, `build.ts` as functions, the bridges, invariants I4, I5, I7, I8, I10; the bug is not one) count too: 6 against 10, still go, so C3 does not depend on the definition. The auth pilot's exceptions (`ref:156-164`) are its own and are not counted here.

## Before and after, and go or no-go

Bucket rules for test lines, fixed now and applied the same way to both sides, by path:

- Kit: `tests/contexts/tools/testing/**` except the conformance suite; before, `tests/contexts/tools/domain/profiles/agent-fixture.ts`.
- Contract and conformance: `tests/contexts/tools/testing/profile-conformance.ts` and `profile-conformance.unit.test.ts`; before, `registry-conformance.unit.test.ts`, which is the `describe.each` over the registered tools it replaces.
- Data snapshot: `tool-support-surface.integration.test.ts`, its JSON reported apart.
- Behaviour: every other file of the slice set after the challenge pass (Appendix A names it), the characterization tests included.
- A case that leaves the slice set for a file outside it (`contexts/translate/domain/build-target.unit.test.ts` and `plugin-format.unit.test.ts`, both new; `contexts/tools/domain/formats/command.unit.test.ts`, existing) stays counted in the after bucket it came from: the whole file when it is new, its added lines when it exists. Leaving the set never lowers a bucket.
- Not in any bucket, reported apart: architecture tests (the rules), and the files outside the slice whose side-effect import line was deleted.

| Measure | Before | How after is measured | Go if |
| --- | --- | --- | --- |
| C1 behaviour test lines (revised criterion 1) | B1, the behaviour bucket of `$B/baseline.txt` (6,414 in planning) | `wc -l` on the behaviour bucket of the final tree | lower than B1 |
| C1, apart, every time | kit 38; contract and conformance 320; data snapshot 88 (JSON 153); total T1, the phase 1 total (6,860 in planning) | the same buckets | reported; and the total not above T1 (C1b, below) |
| C2 files touched to add `zeta` (revised criterion 2) | B2, the phase 1 count of code and test files outside the profile (24 in planning: 7 code, 17 test); 3 inside; 4 snapshots; 2 config; docs D1 (6 in planning); apart: 1 scripts test, 11 plugin files | the same copy procedure on the final tree | (a) code and test outside the profile at most 7 (4 code, 3 test, as predicted), an absolute ceiling; (b) at most B2 minus R, R the import-only test files the plan predicts removing (8 in planning), counted in phase 1; no new test file; docs at most D1; snapshots, config and the two apart counts reported |
| C3 exceptions against ambiguities | 3 against 10 (planning count, recorded by phase 1) | counted from the lists as they stand after phase 10 | exceptions not more than ambiguities |
| Tests and time | 583 tests, 4.2 to 4.9 s under load; phase 1 three quiet runs | same command, three runs | reported; no time gain claimed |
| Mutation | 8 scopes, 12 CI jobs, 2,981 / 4,359 job-seconds on `main`; local times from phase 1 | `sbx node scripts/run-mutation.mjs tools --force`, timed; shard legs timed apart | reported: merged score, its floor, local wall time against the sum of the 8 local runs, legs and the widest leg; per-file scores of kilo and antigravity |
| Source files and lines | slice source as in the baseline | `wc -l` | reported |
| Conformance | 0 profile-independent cases a new tool inherits (`registry-conformance` lists tools by hand) | cases in `describeProfileConformance`, each seen red | K1 to K12 present, each seen red once |

C1b is this plan's addition to the user's revised criterion, recorded before execution and open to removal by the person before phase 1: in this slice the main lever is moving existing cases from behaviour files into the conformance suite and the kit, so C1 alone would be met by reclassification. Unlike auth, where the 349 contract-suite lines were new capability, here the suite replaces cases that exist. C1 counts as met only if C1b holds too; the target's own estimate, a net 500 to 800 fewer lines (`target/07-test-architecture.md:183`), is reported against, not gated.

C2's threshold is the file-by-file prediction under "The representative change": 7 code and test files is the floor this slice reaches, not the target's one file and one line (`target/00-overview.md:115`), because five of the seven follow from the frozen help text (`target/00-overview.md:228`: the two strings, the two tests that pin them, the ratchet that counts them), one is the list and one is M-T1. Below the target's figure, said now: a go on C2 proves the registration cost falls from B2 (phase 1) to at most 7, not that it reaches one.

Go: C1 (with C1b), C2 and C3 all met. Otherwise no-go, and the model is revised before stage C (`target/00-overview.md:197,201`).

## Phases

| # | Phase | Model | Depends on |
| --- | --- | --- | --- |
| 1 | Baseline capture | haiku runs; sonnet for the `zeta` copy | none |
| 2 | Freeze behaviour: characterization | sonnet; proofs reviewed in phase 11 | 1 |
| 3 | Seams: the registration list and the catalog built from it | opus designs the catalog shape, sonnet edits | 2 |
| 4 | Move: the kit folder | sonnet | 3 |
| 5 | Rename | sonnet | 4 |
| 6 | Logic: conformance suite, kit, catalog test, the per-tool files read case by case | opus designs the suite, sonnet edits | 5 |
| 7 | The rest of the challenge pass | sonnet; each deletion's proof reviewed in phase 11 | 6 |
| 8 | Mutation scopes merged | sonnet edits, haiku runs | 7 |
| 9 | Rules in force with planted trees | sonnet | 6, 8 |
| 10 | Reference, memory, rules, target docs | opus decides the reference changes (a design decision), sonnet edits | 9 |
| 11 | Gates, after measures, go or no-go | haiku runs the gates, sonnet the `zeta` copy; opus the final review (the proofs of phases 2, 7 and 9) and the verdict | 10 |

### Phase 1: Baseline capture (haiku; sonnet for step 7)

Files: none in the repository. Output in `$B`.

1. `$B/slice-tests.txt` and the source list re-derived; lines into `$B/src-lines.txt`, `$B/test-lines.txt`, per bucket.
2. Tests and time: three quiet runs of the slice command, JSON; one run with `--expect.requireAssertions`.
3. Leave-one-out coverage under `bash` (zsh does not split an unquoted list): all 76 files, then once without each, `--coverage.enabled --coverage.reporter=json --coverage.include=<slice sources>` with the four `--coverage.thresholds.*=0`, into `$B/cov-all` and `$B/cov-wo-<n>`; covered statements and branches compared.
4. `jscpd` and duplicate titles into `$B`.
5. Mutation, local and forced, each timed: `sbx node scripts/run-mutation.mjs <scope> --force` for `tools` and the 7 `tools-*`; scores and mutant counts from `reports/mutation/<scope>/`.
6. `sbx npx vitest run --project=architecture`, green.
7. The representative change, before, by the procedure (sonnet); the named list into `$B/zeta-before.txt`.
8. Re-check the citations that were not verified at planning: `setup-wiring.integration:368`, the registry-conformance line ranges, `translate.ts:75`, `menu-use-case.ts:48,69`, `init-use-case.ts:52`.
9. Re-count the files that name a profile module with `grep -rlE "profiles/[a-z]+/profile(\.js|\.ts)" tests src`, which also lists named and dynamic imports (the side-effect grep of "Measured baseline" misses the dynamic `await import` of `hooks-descriptor-contract.integration.test.ts`); the side-effect count is the subset to delete.

Acceptance: `ls "$B"` lists each output; `git status --short` prints only `?? aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-second-pilot.md`.

### Phase 2: Freeze behaviour, characterization (sonnet)

Files: new tests only. Each is written against the real composition, and proven by inverted proof (`target/00-overview.md:151`): the behaviour broken by hand, this test and only this one red.

- C1: the order in which the real composition's registry yields its tools is antigravity, claude, codex, copilot, cursor, kilo, opencode, vscode (`init-use-case.ts:52`, `doctor-layout-use-case.ts:31` iterate it). Proof: swap two side-effect imports in `runtime/wiring/framework.ts:2-10`, C1 red.
- C2: a tool with no config asset yields none from the asset provider, and one with assets yields exactly its own (`asset-loader.ts:28-35`). Proof: give antigravity an asset, C2 red.
- C3: the set of registered tools equals `AI_TOOL_IDS` plus `IDE_TOOL_IDS`, both ways, through the real composition (`registry-conformance.unit.test.ts:80,119` cover one way each with a hand-registered set). Kept only if its inverted proof shows nothing else red; otherwise not written (relevance rule, `target/00-overview.md:150`).
- The help strings are held by `golden/help-surface.golden.test.ts`; cited, no new test.

Acceptance: `sbx npx vitest run $(cat "$B/slice-tests.txt") <the new files>` green, 583 plus the kept characterization tests; each proof written in Appendix A.

### Phase 3: Seams (opus designs, sonnet edits)

Files: `registered-profiles.ts` (new), `registry.ts`, the 8 `profile.ts`, the 3 wiring files, the 105 test files' import lines, `setup-wiring.integration.test.ts:368`, `tool-support-surface.integration.test.ts` imports, `tool-addition-cost.arch.test.ts` (`isAllowed`).

1. Opus decides the shape of `createToolCatalog(profiles)` and of its override for E-T1 (the design decision of this phase), behaviour-identical, before any edit.
2. The list in today's order (C1); the registry reads one catalog built from it; `registerTool` overrides that catalog.
3. `registerTool` lines out of the profiles; side-effect imports out of the wiring and the tests (a scripted edit, then each file read back, `aidd_docs/memory/coding-assertions.md`).
4. `setup-wiring.integration.test.ts:368` rewritten to the 8-profile help.

Acceptance: `cd cli && sbx npx vitest run` green (all projects), `pnpm typecheck`, `pnpm lint`; C1 to C3 green; `grep -rn 'import ".*profiles/.*/profile.js"' src tests` prints nothing.

### Phase 4: Move (sonnet)

Files: `tests/contexts/tools/domain/profiles/agent-fixture.ts` to `tests/contexts/tools/testing/agent-fixture.ts` and its importers.

Acceptance: the slice command green, same test count; `pnpm knip` green.

### Phase 5: Rename (sonnet)

Files: `vscode/profile.ts` export `vscodeToolConfig` to `vscode`, its 3 importers.

Acceptance: `pnpm typecheck`, the slice command green, same count.

### Phase 6: Logic (opus designs the suite, sonnet edits)

Files: `testing/profile-conformance.ts`, `testing/profiles.ts`, `domain/profiles/profile-conformance.unit.test.ts`, `domain/catalog.unit.test.ts`, `domain/formats/command.unit.test.ts`, `contexts/translate/domain/{build-target,plugin-format}.unit.test.ts`, the 8 `profiles/<tool>/profile.unit.test.ts`, the 44 parallel files, the 5 hooks files, the 8 root files, `asset-loader.ts`, `golden/framework-build-golden.golden.test.ts` (`FLAT_TARGETS` and the cell-count strings derived from the catalog), `contexts/framework/application/uninstall-use-case.unit.test.ts` (the error string built from `AI_TOOL_IDS`).

1. Opus decides the content of K1 to K12 and of the kit's broken-profile and broken-descriptor builders (the design decision of this phase); sonnet writes them, each case seen red against its broken value. Opus decides K9 to K12 and `CANONICAL_HOOK_EVENTS` from the peer hooks map, [hooks-host-map.md](hooks-host-map.md), kept beside this plan as input. Declared events are those observed fired, not documented-only: SubagentStop is declared for Codex and Copilot, as the host map says; agy declares no UserPrompt and no SessionEnd.
2. The loop over `REGISTERED_PROFILES`; `registry-conformance` split by its row.
3. The 34 small and 10 longer parallel files and the 5 hooks files read case by case (A6); every move written in Appendix A with its proof.
4. The catalog test over synthetic profiles; `asset-loader.ts` partial map (C2 green).
5. The two derived golden expectations and the derived error string, so adding a tool edits none of them.

Acceptance: `cd cli && sbx npx vitest run` green; the conformance file loops over 8 profiles; `size_check src/contexts/tools/domain/registry.ts src/contexts/tools/domain/profiles/registered-profiles.ts src/runtime/assets/asset-loader.ts` prints nothing; test files under 400 lines (`test-file-size.arch.test.ts`).

### Phase 7: The rest of the challenge pass (sonnet)

Files: the 7 `build.unit` files, the 11 other profile files, Appendix A.

The pre-filter's candidates read; deletions only with their inverted proof (never the golden, A8); Appendix A completed and counted.

Acceptance: the slice command green; Appendix A has a row per test before and after; the counts add up to the before and after totals.

### Phase 8: Mutation scopes merged (sonnet edits, haiku runs)

Files: `cli/mutation-scopes.json`, `cli/package.json`, `tests/architecture/mutation-shards.arch.test.ts`, `.github/workflows/cli-ci.yml:617`.

1. `sbx node scripts/run-mutation.mjs tools --force` on the merged glob, timed, with the shard count that keeps the widest leg under today's widest (545 s in CI; the local equivalent from phase 1).
2. Floor set to the measured score, rounded down (A4); kilo's and antigravity's file scores written in the scope's `$comment`.

Acceptance: `sbx npx vitest run --project=architecture` green (`mutation-covers-source`, `mutation-shards`); the merged score at or above its new floor.

### Phase 9: Rules in force with planted trees (sonnet)

Files: `tests/architecture/tool-addition-cost.arch.test.ts` (RT1, RT2), the conformance suite (RT3), `mutation-covers-source.arch.test.ts` (RT5).

Each rule seen red on its planted tree, then green on the real one.

Acceptance: `sbx npx vitest run --project=architecture` green; each planted tree's red run written down.

### Phase 10: Reference, memory, rules, target docs (opus decides the reference changes, sonnet edits)

Files: `cli/.claude/rules/cli-contexts/reference-context.md` (the second pilot's result and what it changes: a catalog and a conformance-suite template beside the contract-suite one, the slice definition of an exception); `src/contexts/tools/glossary.md`; `cli/.claude/rules/cli-contexts/tools.md`; `cli/.claude/skills/tools/SKILL.md` and its references; `cli/aidd_docs/memory/testing.md:22,45` (its Conventions still list `hooks` as a per-feature profile test file; K9 to K12 replace it), `codebase-map.md:143`, `architecture.md` (the hooks bullet gains "events are data on the descriptor, checked by conformance"); the code map rows; this plan's lists.

Acceptance: `pnpm exec lefthook run pre-commit --all-files --force` green (`referenced-paths`, `markdown-links`, `doc-duplication`, `context-imports`).

### Phase 11: Gates, after measures, go or no-go (haiku, sonnet, then opus)

1. `pnpm exec lefthook run pre-commit --all-files --force`, `pnpm exec lefthook run pre-push --all-files --force`, `pnpm test:coverage`, `pnpm build`, `pnpm jscpd`, all green.
2. Every line of "Before and after" re-measured with its command into Appendix B.
3. The `zeta` change on the final tree by the same procedure, into `$B/zeta-after.txt`.
4. Opus, final review: every inverted proof of phases 2 and 7 and every planted tree of phase 9 re-read against Appendix A; a proof that does not hold reopens its phase.
5. The verdict, against the thresholds as written; nothing re-classified after the measure.

Acceptance: Appendix B and the verdict filled; `git status --short` shows the plan's changes only, uncommitted.

## Decisions

| Decision | Why |
| --- | --- |
| The second pilot is the profile slice of `tools`, not a whole context | the only profile-heavy candidate of bounded size; whole `tools` needs `host-registration` first |
| Profiles and the registration list stay in `contexts/tools` (A1) | the overview defers `composition/tool-profiles/` to stage D, and placing it there needs the catalog injected into 141 importers |
| The catalog is built, not injected (E-T1) | eager registration was probed: 3 failures in 7,058 tests, against an injection that rewrites 55 `src` files |
| Criterion 1 carries C1b, total lines not up | moving cases into the conformance suite would meet C1 by reclassification alone |
| `ToolCatalog` takes its profiles in its constructor, no `createToolCatalog` | the constructor already refuses a duplicate id; a factory would remove nothing |
| The help strings stay written out | no existing order reproduces them, and help text is frozen surface |

## Risks, limits and open questions

- C1b is this plan's addition to the user's criterion; the person may strike it before phase 1, and then C1 is judged alone, with the total reported.
- C2's prediction rests on K3 checking a new profile's build paths well enough that its conventions need no per-tool test; if the executor of phase 11 has to add one, C2 fails and the threshold stays.
- Merging the per-profile scopes makes `tools` the longest scope in CI, which is why it was split (`mutation-scopes.json` `$comment`); phase 8 shards it and reports the widest leg. Every scope a change touches still gates per PR today (`ref:134`).
- The planning times ran under concurrent load; only phase 1's quiet runs compare with phase 11's.
- The measuring run's headline count (38) and its named list (40) disagree; the named list is used and phase 1 re-counts.
- Found while measuring, out of scope: the `SkillsCapability` prefix-mode path hard-wire. The golden test's stale "9-cell" comment is gone: its cell counts derive from the matrix.

## Appendix A: traceability

Filled in phases 2, 6 and 7: one row per test before and after (file and title, behaviour pinned, pre-filter flags, verdict, target, proof), then the counts per bucket.

Phase 2 characterization proofs (slice plus new files, run through the sandbox):

| Test | Break applied | What went red |
| --- | --- | --- |
| C1 `tests/runtime/wiring/registered-tools.integration.test.ts`, registration order of the real composition (integration: it imports `runtime/wiring/framework.ts`, the composition, like `create-deps.integration.test.ts`) | swap the antigravity and claude side-effect imports in `runtime/wiring/framework.ts` | only C1 (1 failed, 610 passed) |
| C1, after phase 3 (the order now lives in `profiles/registered-profiles.ts`) | swap the antigravity and claude lines of `REGISTERED_PROFILES` | only C1 (1 failed, 177 passed, over the slice list plus `tests/runtime`, `tests/contexts/tools`, `tests/architecture`) |
| C2 `tests/runtime/assets/asset-loader-config-assets.unit.test.ts`, config assets per tool through the wired `BundledAssetProviderAdapter` (unit: no fs, no process) | `antigravity: { "settings.json": claudeSettings }` in `CONFIG_ASSETS` | only C2, its antigravity case (1 failed, 7 passed in the file; no other slice file red) |
| C3 set of registered tools equals `AI_TOOL_IDS` plus `IDE_TOOL_IDS` | `IDE_TOOL_IDS = []` in `kernel/tool.ts`: C3 red together with 3 tests of `tool-config.unit.test.ts` (4 failed). Deleting the vscode import in `framework.ts`: nothing red, vscode still registers through another import | dropped: another test goes red for the kernel-side break and no registry-side break was found that C3 alone catches (relevance rule); not written |

Slice plus kept new files: 610 tests in 78 files (601 baseline, 1 for C1, 8 for C2).

Phase 6 proofs (file and title, verdict, target, proof). Every proof: break by hand, the named target goes red, revert.

| File | Title | Verdict | Target | Proof |
| --- | --- | --- | --- | --- |
| hooks-descriptor-contract.integration | has a descriptor exactly when it runs hooks | moved | profile-conformance-files "has a hooks descriptor exactly when it runs hooks" | added profiles/vscode/hooks.ts (export {}) -> target red (and "reads at least one" red), reverted |
| hooks-descriptor-contract.integration | descriptor exported under the tool's name | moved | profile-conformance-files "exports its descriptor under the tool's name" | renamed CODEX_HOOKS to CODEX_HOOK in codex hooks/profile/build -> target red, reverted |
| hooks-descriptor-contract.integration | comes with a captured payload | moved, tightened to one per relayed event | profile-conformance-files "comes with one captured payload per event it relays" | moved fixtures codex-Stop.json away -> target red, restored |
| hooks-descriptor-contract.integration | reads at least one tool that runs hooks and one that runs none | kept | profile-conformance-files same title | ghost vscode/hooks.ts -> red |
| hooks-descriptor invariants (new) | 7 builders | added | hooks-descriptor-invariants.unit | each refuse() in declareHooks voided one by one -> exactly its case(s) red, restored |
| profile checks (new, 16+6) | each check | added | profile-conformance-proof.unit | no-op'd holds of 3 profile checks and 1 file check -> that check's "fails its own broken profile" red, restored |
| registry-conformance.unit (25 cases) | each case | moved to `PROFILE_CHECKS` or `catalog.unit` / `catalog-registered.unit` | the check or catalog case of the same name | uniqueness, directory, probe, token, suffix, hooks support, mcp, plugins each broken in the registered profile or a kit profile: that check red, not another; the kilo and opencode marketplace probe row goes red when either drops its probe |
| registry.unit (9) | each case | moved | `catalog.unit` | duplicate check, replacing unknown, replacing swap, copy of `getAllRegisteredTools`, `hasToolSignals` guard: each mutation reds its case |
| tool-config.unit (14) | each case; line 26 | moved; line 26 deleted | `catalog.unit`; line 26 by the swap proof | swapping two registered profiles turns other cases red |
| host-ref-in-use.unit, plugin-enablement-is-machine-global.unit, build-hooks-support-declaration.unit | each case | moved | `catalog-registered.unit` rows and `profile-conformance` "lets its flat build carry hooks exactly when it accepts them" | `hostRefInUse`, enablement and build mode mutations red the named rows |
| plugin-root-token-declaration.unit | declaration cases (4) | moved | `PROFILE_CHECKS` "declares a plugin root token exactly in native mode", "names a variable, never a path", "writes its own token into a marketplace build", "writes no token into a flat build" | claude `pluginRootToken` removed from `build.ts`: those checks red; the marketplace-route describe (2 cases) stays |
| claude, codex, copilot, cursor `agents.unit` | names an unnamed plugin agent after its file (4) | deleted | `agents-capability.unit` "names an agent after its file when the frontmatter declares none" | `agents-capability.ts` `name: agentNameFromFrontmatter(fm, fileName)` replaced by `fm`: all 4 copies red, then after deletion the target stays red |
| claude, copilot, cursor, opencode `plugins.unit` | has a plugins capability (4) | deleted | `PROFILE_CHECKS` "declares a plugins capability" | `plugins:` key renamed in each `profile.ts`: copy red and the check red for that tool |
| claude, codex, copilot `mcp.unit` | consumes the mcp config name (3) | deleted | `PROFILE_CHECKS` "feeds its mcp file from the mcp config" | `consumes: [CONFIG_MCP]` emptied in each `profile.ts`: the check red for that tool |
| claude `content.unit` | routes a numbered command folder under commands/aidd/<phase>/ | deleted, the check tightened to `toBe` | `PROFILE_CHECKS` "routes a numbered command and its references to the same folder" | the `@` prefix dropped in `rewriteContent`: the old `toContain` stayed green, the `toBe` form goes red; digit separator broken: red |
| codex `hooks.integration` | returns null entry section for unknown config names | deleted | same file "uses SessionStart as entry section" | `getEntrySection` returning "x": the unknown-name case stays green, the target red |
| uninstall-use-case.unit | refuses to remove nothing | rewritten, tool list derived from `VALID_TOOL_IDS` | itself | message list reversed in the source: red |
| framework-build-golden.golden | matrix covers every tool | first half deleted (tautological once the matrix derives from `AI_TOOL_IDS`); the stored-cell half stays | the same test | cells keyed by id, `stored[key]` missing-cell assertion kept |

Phase 7 proofs (install-path cases of the per-tool parallel files, rows of each tool's `profile.unit` table; every proof: break by hand in src, the named row red, revert, `git diff -- cli/src` empty):

| File | Title | Verdict | Target | Proof |
| --- | --- | --- | --- | --- |
| claude, codex, copilot, cursor, opencode, antigravity, kilo: skills, agents, commands, rules `buildInstallPath` cases (about 45) | one per path | rewritten as rows of `installs %s file %s at %s` | `<tool>/profile.unit` | `rules/` renamed `rule/` in claude, opencode and kilo `profile.ts`: that row red; `.prompt.md` broken in copilot: 4 command rows red; `.mdc` broken in cursor: its row red; codex skills prefix broken: its 5 rows red |
| claude, cursor, copilot, opencode, codex `skills.unit`, copilot `commands.unit` | files | deleted, every case moved to a row | `<tool>/profile.unit` | as above |
| codex `profile.unit` | has toolId codex; is registered in the tool registry | deleted | `PROFILE_CHECKS` "is registered once, under its own id" | codex `toolId` changed to "codexx": conformance red (77 red in total, none of them the deleted cases) |
| copilot, vscode `settings.unit` | each case | rewritten as one `it` and a three-row table | `copilot/profile.unit`, `vscode/profile.unit` | copilot merge strategy flipped: its case red; vscode extensions path broken: its row red |
| claude, copilot, cursor, codex `build.unit` | sources the plugin tree (6 blocks); keeps the plugin-relative path (3) | rewritten over `PLUGIN_TREE_SOURCES` and `PLUGIN_RELATIVE_PATHS` | `testing/build-artifacts.ts` kit helpers | unchanged expectations, same assertions |

Phase 7 merges (second round; every proof: break by hand in src, the named test red, revert, `git diff -- cli/src` empty):

| File | Title | Verdict | Target | Proof |
| --- | --- | --- | --- | --- |
| claude, cursor, copilot, codex, opencode `build.unit` | prefixes a flat skill's folder; prefixes a flat agent's file (10) | merged into a table | `<tool>/profile.unit`, row "places a flat skill and agent under its plugin's name" | `skills/` or `agents/` renamed in each build.ts: only that tool's own `profile.unit` row red (claude, cursor, opencode, codex, copilot `rewriteSkillName` and agents directory); `rewriteSkillName: false` in each of the five: only its row; copilot `.agent.md` broken: the row plus the `build.unit` case that renames a flat agent |
| claude, cursor `build.unit` | builds the catalog; builds a catalog entry (4) | merged into a two-row `describe.each` | `claude/profile.unit`, `cursor/profile.unit` row "writes its catalog and entries in Claude's marketplace format" | `marketplace.json` and `plugin.json` paths broken in `claude-build-paths.ts` and `cursor-paths.ts`: only that tool's `profile.unit` row red for `marketplace.json`; `plugin.json` red together with the `build.unit` manifest-path case and, for cursor, `hooks-routes`, so the row stays on `marketplace.json` alone; cursor `schemaName` red with `hooks-routes` |
| claude, cursor, copilot, codex `build.unit` | sources the plugin tree (marketplace and flat), plugin-relative paths (10) | merged into tables | `<tool>/profile.unit` row "ships the plugin tree as it is" (codex: "sources the plugin tree as it ships, and stages an agent named with an inner .md as .toml") | `srcDir`, `srcPath` and `.mcp.json` path broken per tool: only that tool's `profile.unit` row red, flat included (claude agents path also red with `agents.unit`; skills and mcp alone) |
| cursor, codex `commands.unit`; claude and opencode "prefixes name" | convertFrontmatter name and strip (4 cases) | merged into conformance | `PROFILE_CHECKS` "names a numbered command after its phase and keeps only what it reads", broken subject of the same title in `BROKEN_PROFILES` | `buildCommandName` returning the bare name: the check red for claude, codex and copilot, with the `formats/command.unit` cases; a `model` copied through: the check red. The kilo case stays: it alone pins that kilo uses the no-hint form |
| claude, cursor, copilot, opencode `rules.unit`; kilo "retains descriptions only for opt-in rules" | convertFrontmatter (19 cases) | rewritten as rows over five profiles | `<tool>/profile.unit` rows "converts %s" | claude `globs` branch and description branch, cursor `", "` join and `alwaysApply` branch, copilot join, opencode and kilo description branch each broken: only that tool's `profile.unit` rows red (copilot `join(",")`, cursor `alwaysApply`, claude, opencode and kilo `alwaysApply === false` branch). Lost datum: the `{{TOOLS}}` placeholder glob of copilot, no other case reads it; codex rules stay (pass-through, not a profile of this table) |
| `testing/profiles.ts` | `withRewriteContent` | deleted with code | none | no caller in `cli/tests` (grep) |
| codex `build.unit` | changes only the trailing .md of a staged / of a flat agent path (2) | merged into the codex `profile.unit` row | `codex/profile.unit` "sources the plugin tree as it ships, and stages an agent named with an inner .md as .toml" | `\.md$` loosened to `\.md` in `codex/build.ts`: that row alone red |
| claude, cursor, copilot `profile.unit` (added, then deleted) | matcher group that declares no hooks list | deleted by proof | `formats/hooks-merge.unit` "a matcher group that declares no hooks list" and `codex/hooks.integration` | `return [...groups]` to `[...listed]` and `listed` to `groups` in `hooks-merge.ts`: each row red only together with those named tests, so the rows lost no proof and went, with their kit helper `mergedHooksOf` and constant. The claude and cursor copies in `hooks.unit` and `copilot/hooks.unit.test.ts` went with them |

Kit cut: only `withRewriteContent` had no caller. Every `with*` method left and every entry of `BROKEN_PROFILES` and `BROKEN_FILE_SUBJECTS` is read by its check (the proof file asserts one broken subject per check, each red on its own check only), so none is removable without losing a proof. Merging near-duplicate broken subjects gains nothing measurable: each differs by the one field its check reads.

Counts, measured by `second-pilot-baseline/count-after.mjs` (before: `count-before.mjs`, tree 833aae713):

| Bucket | Files | Tests | Lines |
| --- | --- | --- | --- |
| Behaviour before | 74 | 539 | 6414 |
| Behaviour after | 64 | 527 | 5578 |
| Conformance before / after | 1 / 5 | 61 / 265 | 320 / 576 |
| Snapshot before / after | 1 / 1 | 1 / 1 | 88 / 80 |
| Kit before / after | 1 / 6 | 0 / 0 | 38 / 653 |
| Total before / after | 77 / 76 | 601 / 793 | 6860 / 6887 |

Placement: the four shared table files of the previous round (`flat-build-paths`, `claude-style-catalog`, `plugin-tree-build`, `rules-frontmatter`) listed tools by hand outside `profiles/<tool>/` and so cost C2; they are deleted. Each row is now in its tool's own `<tool>/profile.unit.test.ts`, run by helpers in `testing/profile-tables.ts` (kit). Test files that still name tool ids outside `profiles/<tool>/` are listed in the report to the caller, not gated here.

Count fix: an earlier recount of 6793 left `testing/profile-tables.ts` out of the kit list. `count-lib.mjs` now lists `tests/contexts/tools/testing/*.ts` itself (`profile-conformance.ts` and `profile-file-conformance.ts` conformance, every other file kit), and `count-after.mjs` exits non-zero on a new or untracked test file under `tests/contexts/tools` or `tests/contexts/translate` that is neither in the slice list nor in RECEIVED (checked with a probe file).

C1 verdict: behaviour after 5578 < 6414 holds. C1b, total after 6887 <= 6860, is NOT met: 27 lines over. C1 is therefore not met as a whole, and the go criterion is not met on C1. What the remaining lines buy: kit 653 = `profiles.ts` 184, `broken-profiles.ts` 165, `profile-tables.ts` 120, `broken-file-subjects.ts` 90, `build-artifacts.ts` 56, `agent-fixture.ts` 38 (each broken subject and builder is read by a check whose red proof stands on it; `profile-tables.ts` carries the rows' shared runners, the catalog assertion alone about 40); conformance 576 = the two sources 241 + 185, plus 150 across three test files, 265 checks over eight profiles; snapshot 80; behaviour 5578, of which the 7 `build.unit` files are cases of one profile (manifest synthesis, agent transforms, mcp merges, TOML) that no other test and no other profile repeats. Hunt for redundancy among this round's rows: every remaining `profile.unit` row goes red alone under at least one src break (flat paths and `rewriteSkillName`, `marketplace.json`, skills and mcp tree paths, the rules branches); none duplicates a conformance check, which asserts shape (relative, non-empty, feeds the mcp config), never these values. The bridges were pre-filtered, not challenged. The per-test rows of phase 7 are grouped as in phase 6, not one row per test; the per-bucket split into kept, rewritten, merged, moved, deleted and added was not reconciled test by test.

## Appendix B: after measures

Filled in phase 11, one row per line of "Before and after", with the command output that gives it.

Re-run, after the revised sections 6, 7, 9 and 10 of the reference:

| Measure | Limit | Measured | Met |
| --- | --- | --- | --- |
| C1 behaviour | below 6414 | 5639 | yes |
| C1b total | at most T1 | 6618 against 6860; with the 5 hooks files, under 7802 either way | yes |
| C2 code and test outside the profile | at most 7 | 2 (`kernel/tool.ts`, `registered-profiles.ts`) | yes |
| New test file outside the profile | none | none | yes |
| Docs | at most 5 | 5, 2 of them generated | yes |
| C3 | exceptions not above ambiguities | 3 against 10 | yes |

- Counts: `count-after.mjs` from `cli/`, total 6618.
- C2: the zeta probe replayed on the final tree, all gates green, then discarded.

Measures: go. Design bar: no-go, pending one decision.

- Pass: the boundary (outside callers reach `tools` through `contract/` only, held by Biome, no `PUBLIC_MODULES` entry), domain purity, construction refusals tested in `define-tool`, characterization deleted.
- Fail, leaking structure: the flat install path is built by `translate/domain/content-translator.ts` and parsed back by `built-tree-materialization-translator.ts` from `directory` and `flatLayout()`; `kind === "native" && requiresUserScope()` is repeated in four framework files; `distributionProbes?.marketplace?.[0]` is read by two callers. Each becomes one profile answer.
- Fail, invariant outside its owner, open: single-profile rules (root token, probes, flat hooks against `acceptsHooks`, artefact paths under `directory`) are checked by conformance over the registration list, not refused by `defineAiTool`. A7 put them in conformance on purpose; the bar requires a refusal at construction. Decided: the target wins. `target/04-tools-and-translate.md:71-104` checks I1 to I10 by the conformance suite over every registered profile, and `:350` holds a profile as data checked by that suite; the bar's construction rule binds aggregates. Not a blocker.
- Reserved to stage D (`target/00-overview.md`, section 12), not debt: the profile in `composition/tool-profiles/` and translation form 1.
- Every other finding is fixed in this PR.
- Stage C blockers whatever the decision: `cli/.claude/skills/tools/SKILL.md` describes the deleted registry; `src/contexts/tools/glossary.md` and `cli/.claude/rules/cli-contexts/tools.md` are missing; E-T3 is not written in reference section 9.

Re-run after the sections refactor and the design-bar fixes (head `87573c633`):

| Measure | Limit | Measured | Met |
| --- | --- | --- | --- |
| C2 code and test outside the profile | at most 7 | 2 (`kernel/tool.ts`, `registered-profiles.ts`), M-T1 written | yes |
| C3 | exceptions not above ambiguities | 6 against 10: E-T3, E-T4, E-T7 kept, E-T8 to E-T10 added; M-T1 to M-T3 are migration state, not counted | yes |
| Gates | all green | unit 4557, integration 2644, architecture 291, golden 6, e2e 88, contract 160; lint, typecheck, knip, jscpd, jscpd:profiles, type honesty, doc duplication | yes |
| Answers | unchanged but the 18 waived duplicate paths | probe diff equals `accepted.txt`; contract folder diff empty; frozen surface only `tests/e2e/helpers.ts` | yes |
| Mutation `tools` | floor | 95.3 | yes |

- Leaking structure, fixed: the flat install path is a profile answer (`flatInstallPath`, `ownsFlatPath`); `requiresUserScope()` is asked once; distribution paths are asked, not indexed. `plugins-are-asked-not-read` holds callers to answers, its allowlist shrink-only and checked against missing files.
- Invariants at construction: `define-tool` refuses an invalid profile, each refusal proven by a planted break (commit body of the layout and manifest sections commit).
- No tool-named identifier in `domain/sections/`, `hooks/`, `bridges/`, `native-registration/`, `profile/` or `profile.ts`; the guard went red on a planted `claudeDir` in each.
- Not exceptions: the shared event bridge is what `target/04-tools-and-translate.md:139` asks for; the antigravity hooks merge and the codex TOML agent writer became tool-free shared code with a thin binder in the profile folder, so the `behaviours/` proposal (`target/04-tools-and-translate.md:140-141`) is not needed; the profile data golden (`:364`) is a stage D proposal.
- Commit `700e57711`'s subject claimed `createDeps` required the catalog while a default remained; the default is now gone and `create-deps-takes-the-catalog` holds it.
- Stage C blockers above: the skill, the glossary, the context rule file and E-T3 are written.
- Cross-context test imports, migration state M-T3: 157 test files outside `tools` import its kit, 40 the `host-registration` kit, 48 `tools/domain`.

Verdict after re-review: pending.

## Design bar (user requirement, checked at every design review)

The pilot fails its review, whatever its measures, if any of these holds:

- An anemic model: a profile, capability or catalog that is only data while the rules about it live in callers. Each rule about a tool (which capabilities it hosts, how a capability lands for it, what makes a profile valid) sits on the object that owns the data, as a method or a domain function next to it, and callers ask instead of inspecting.
- An invariant enforced outside its owner: a profile that can be built invalid (duplicate tool id, a capability without the format it needs, a registration missing a required field) is refused at construction, with a test per invariant.
- A pattern used for its name: a registry, factory, strategy or visitor exists only where it removes a branch or a duplicate that is measured in the baseline; otherwise it is plain functions.
- Leaking structure: callers outside the slice reach a profile's fields to decide something the profile could answer.
- A dependency pointing inward from the domain: profiles and capabilities import no infrastructure, no `node:*` beyond `node:path` and `node:crypto` (the reference's section 4, line 79), no third-party package.

Phases 3 and 6 end with an opus design review against this bar before the phase is committed; phase 11's final review re-checks it on the whole slice.

## Red proofs

| Check | Break | Red line |
| --- | --- | --- |
| is registered once, under its own id | profile listed twice in the registration | `expected [ { kind: 'ai', …(8) }, …(1) ] to have a length of 1 but got 2` |
| has a well-formed shape | toolSuffix `md` without the dot | `expected false to be true // Object.is equality` |
| keeps a relative directory ending in a slash | directory `/abs/` | `expected false to be true // Object.is equality` |
| computes every path relative, and keeps commands, rules, agents and flat hooks under its directory | command install path `../escape.md` | `installed path: ../escape.md: expected true to be false // Object.is equality` |
| builds neither rules nor commands from the plugin tree | flat contract supports rules from the tree | `expected true to be false // Object.is equality` |
| gives every supported artifact a non-empty path | skills path returns an empty string | `skills: expected '' not to be '' // Object.is equality` |
| is reachable by at least one build | no build contract | `expected 0 to be greater than 0` |
| is probed where it publishes a marketplace | marketplace contract, no probe | `expected 0 to be greater than 0` |
| drives native activation where it declares marketplace settings | native plugins with marketplace settings | `expected null not to be null` |
| lets its flat build carry hooks exactly when it accepts them | accepts hooks, flat build without them | `expected false to be true // Object.is equality` |
| declares a plugin root token exactly in native mode | native mode, no root token | `expected false to be true // Object.is equality` |
| names a variable, never a path | token `$PLUGIN_ROOT` | `expected '$PLUGIN_ROOT' to match /^\$\{[A-Z_]+\}$/u` |
| writes its own token into a marketplace build | marketplace build writes `${OTHER}` | `expected '${OTHER}' to be '${FAKE_PLUGIN_ROOT}' // Object.is equality` |
| writes no token into a flat build | flat build writes a token | `expected '${FAKE_PLUGIN_ROOT}' to be undefined` |
| declares a plugins capability | plugins capability removed | `expected undefined to be defined` |
| feeds its mcp file from the mcp config | mcp output with no mcp config | `expected [] to include 'mcp'` |
| routes a numbered command and its references to the same folder | command folder `aidd/04` against reference folder `04_code` | `claude: .fake/commands/04_code/implement.md: expected '.fake/commands/04_code/implement.md' to be '.fake/commands/aidd/04/implement.md' // Object.is equality` |
| names a numbered command after its phase and keeps only what it reads | frontmatter passed through unconverted | `expected { name: 'implement', …(2) } to match object { name: 'aidd:04:implement', …(1) }` |
| sits in a profile folder the registration lists, and every folder is registered | folder `ghost` on disk, unregistered | `expected [ 'claude' ] to include 'ghost'` |
| has a hooks descriptor exactly when it runs hooks | hooks accepted, no `hooks.ts` | `expected false to be true // Object.is equality` |
| exports its descriptor under the tool's name | export named `OTHER_HOOKS` | `CLAUDE_HOOKS: expected undefined to be defined` |
| relays only events its descriptor declares | adapter relays `Stop`, undeclared | `Stop relayed, never declared: expected undefined to be defined` |
| generates a bridge for exactly the events it relays through one | bridge relay, generator returns null | `expected [] to deeply equal [ 'SessionStart' ]` |
| comes with one captured payload per event it relays | no payload fixtures | `claude: no payload for SessionStart: expected false to be true // Object.is equality` |
| `registeredIdsMatchKernel` | kernel ids missing from the list | throws |
| `tools-travel-as-the-catalog`: types no profile list outside the tools context and presentation | `export type Plant = ToolProfile[];` in a framework file | `Received ["src/contexts/framework/zz-plant.ts"]` |
| `create-deps-takes-the-catalog`: passes all four arguments wherever src calls it | `createDeps(root, opts, out);` in a framework file | `Received ["src/contexts/framework/zz-plant.ts"]` |
| `source-tree-holds-only-source`: has no file with an extension outside .ts and .md | a `zz-plant.ts-E` file under src | `Received ["src/contexts/framework/zz-plant.ts-E"]` |
| `profiles-are-islands`: has no profile importing a file of another profile | claude file importing `../codex/codex-paths.js` | `Received ["...profiles/claude/zz-plant.ts -> ...profiles/codex/codex-paths.ts"]` |
| `plugins-are-asked-not-read`: no code outside the tools context reads a field of a plugins capability | `tool.section("plugins").hooksAcceptance` in a framework file | `Received ["src/contexts/framework/zz-plant.ts :: reads .hooksAcceptance"]` |
| `tool-id-list-is-the-catalogs`: is named only in the kernel and the tools context | `void AI_TOOL_IDS;` in `doctor-registration-use-case.ts` | `ask ToolCatalog.aiIdsInCanonicalOrder() instead: expected [ Array(1) ] to deeply equal []` |
