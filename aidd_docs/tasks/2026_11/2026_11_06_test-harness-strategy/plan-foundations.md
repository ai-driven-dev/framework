---
objective: "`src/shared/{ports,infrastructure}` exists with the HTTP port, the HTTP client, the GitHub adapter and the environment port and adapter, guarded by its own boundary rules; three of the four architecture rules the guideline PR must reconcile (`0-orchestration.md`, `0-shared-modules.md`, `0-contexts.md`) say one thing each, the fourth (`0-deps-wiring.md`) landing with the pilot's first file of `composition/`; the command constructor cap is 5 with one owner; the old-layout counter bounds `runtime/` and `framework/` by count and `kernel/` by its committed path set; no product behaviour changes; and the auth pilot starts with 6 pre-registered exceptions instead of 9, plus 4 migration-state deviations registered openly."
status: pending
---

# Plan: foundations before the auth pilot

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | The smallest behaviour-neutral PR that removes the structural exceptions of the auth pilot: the shared technical home and its rules, the conventions that contradict the target, and nothing more. |
| **Source** | Text request (foundations PR before stage B), grounded in `plan-pilot-auth.md` (section "Before and after, and go or no-go", exceptions E1 to E9 and line 385); `target/00-overview.md` sections 2, 3, 5, 6, 7, 11 items 6 and 7, 12, 15; `target/03-orchestration-composition-presentation-shared.md` sections 7 and 8; `target/05-distribution-auth-update.md` sections 2 and 4 and its decisions; `target/08-guardrails-and-repo-map.md` sections 2 and 7; `target/09-code-map.md` and the code-map parts `src-runtime-kernel-presentation-distribution.md`, `src-framework.md`, `src-telemetry.md`, `harness-and-repo.md`; `cli/.claude/rules/00-architecture/*`; `cli/tests/architecture/*`; `cli/biome.json`; branch `chore/code-size-rules`; the independent challenge of this plan (section "Changes after challenge"). Code read on branch `refactor/foundations` (tip of `test/file-port-contract`), which wins wherever a target document disagrees. |

Conventions of this plan:

- Paths are relative to the repository root unless they follow `cd cli`. `target/*` means the files under `aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/target/`; `pilot` means `plan-pilot-auth.md` beside this file.
- Each phase starts with the sandbox of the pilot plan, so no measured run sees the real home or a real token:

  ```sh
  B="${TMPDIR:-/tmp}/aidd-foundations-baseline"; mkdir -p "$B"
  SBX="$(mktemp -d "${TMPDIR:-/tmp}/aidd-foundations-XXXX")"; mkdir -p "$SBX/home" "$SBX/cfg"
  sbx() { env -u AIDD_TOKEN -u GH_TOKEN -u GITHUB_TOKEN HOME="$SBX/home" AIDD_USER_CONFIG_DIR="$SBX/cfg" "$@"; }
  ```

- Safety: no `aidd`, no `node dist/cli.js`, no `pnpm smoke` by hand (`cli/scripts/smoke-tools.sh:158` reads `gh auth token` from the real home); every vitest and stryker run goes through `sbx`. Never a bare `git stash`. No branch is switched, rebased or pushed by this plan. Nothing is committed by this plan.
- Migration rules, for every phase: green at the end of each phase; move before rename before logic change; the checklist of files that name paths (`target/00-overview.md:163`) is applied in the phase that moves the path; a rule enters with a planted violation that proves it bites, run red without the rule first; `BASELINE` entries are only lowered or removed.
- Model tiers: opus for design and review, sonnet for edits, haiku for gates and measures.

## Changes after challenge

An independent challenge returned "execute with changes". The coordinator's decisions were applied; none was rejected. Each line names where the plan changed and the evidence.

| Item | Change | Evidence |
| --- | --- | --- |
| DB1 | `chore/code-size-rules` is not stacked. Phase 0 step 1 (rebase, force-push, retarget) and its `merge-tree` acceptance deleted; D9 rewritten; the phase 4 text of `0-orchestration.md` drops the `0-code-size.md` sentence, which, with the code-size branch's own line "for a use case the four above is stricter and applies", goes to whichever PR lands second; the stack branches of the pilot-change table removed | coordinator decision; the code-size branch adds one line to `0-orchestration.md` (`git diff` of that file), the only hunk the two PRs share in rule text |
| DB2 | Four migration-state deviations registered in their own section, two of them created by this PR (`HttpGet` with one importing context, `Environment` with one consumer until the pilot); a row of the pilot-change table pre-registers them with "auth imports `kernel/`" and "presentation reaches `createDeps`"; the pilot's third criterion recounted openly under both readings | rule 8, `target/00-overview.md:69`; `target/05-distribution-auth-update.md:62`; `github-raw-fetcher-adapter.ts:12` is the only context importer of `HttpGet` |
| SF1 | Every `composition/` change left phase 1 (`contextOf`, `BELOW_NOTHING`, `isCompositionRoot`, `areaOf`) and moved to the pilot's phase that creates `composition/auth.ts` | a guard taught a folder no file is in proves nothing on the real tree; the Biome groups and the rule text already wait for that file (D2) |
| SF2 | `earned-sharing.arch.test.ts` untouched; `src/shared/**` has no computed sharing check until stage C step 4, stated in Risks | `earned-sharing.arch.test.ts:37-39`: `/\/shared\/[^/]+$/` does not match `src/shared/ports/http-get.ts`, the only shape this PR creates |
| SF3 | Missed path-naming items added to phase 2 and 4: the `noRestrictedGlobals` message, `cli/ARCHITECTURE.md` kernel rows, `0-shared-modules.md:18` and its `paths:`, `.claude/skills/distribution/SKILL.md:14`, `0-contexts.md:14`, `CITED_PATH` gains `shared`; the phase 4 grep covers `biome.json`, `ARCHITECTURE.md` and `.claude` | `cli/biome.json:555` names `framework/domain/ports/environment.ts`; `cli/ARCHITECTURE.md:24` ("ports shared by two contexts or more" in `src/kernel/`), `:41`; `0-shared-modules.md:18` ("Move to `kernel/` only once it stops being business logic"); `SKILL.md:14` ("depends on `kernel` only"); `0-contexts.md:14` ("Arrows run one way, toward the kernel"); `referenced-paths.arch.test.ts:19-20` |
| SF4 | Kernel rule: no new file in `kernel/`; a new typed error still goes to `kernel/errors.ts` until stage C. The counter holds `kernel/`'s committed path set, so a delete plus an add fails | a count alone lets one file be swapped for another; `0-error-handling.md:22` makes `kernel/errors.ts` the one catalog |
| SF5 | Phase 2's acceptance expects phase 1's architecture count plus the cases phase 2 adds | phase 2 adds planted Biome cases and a parity case |
| S1 | Phase 4 renames `MAX_INJECTED_USE_CASES` and the test titles to a constructor-dependency cap | the test counts every constructor parameter, not only use cases (`orchestrator-deps.arch.test.ts:146-156`) |
| S2 | Phase 5 reports per-file mutation scores of `shared` (`http-client.ts` 93.02 with its 10 timeouts) and the `framework` score after the move; the PR body states them | the probe of the baseline table |
| S3 | Items 7a to 7c of `target/00-overview.md:164` land here, 7d in the pilot; one owner for the constructor cap decided (D14) | `target/00-overview.md:164` lists four rules |

## Exceptions E1 to E9 after this PR

Removed: 3 (E3, E4, E7). Kept: 6 (E1, E2, E5, E6, E8, E9). The request's premise was that 7 of the 9 exist only because `shared/`, `composition/` and the conventions are missing. Read against the code, only 3 do. The pilot itself names `orchestration/`, not `composition/`, as the missing structure (`pilot:385`), and none of E1 to E9 cites `composition/`. The recount of the third criterion, with the migration-state deviations, is in the next section.

| # | Verdict | How, or why it stays |
| --- | --- | --- |
| E1 `framework -> auth` in `ALLOWED` | kept | It goes only when `doctor-layout-use-case.ts:2` and `setup-marketplace-registration-use-case.ts:6` leave framework for `orchestration/`, which is the framework split (stage C, `target/00-overview.md:201`). Moving `TokenProvider` into `shared/ports` instead would contradict `target/05-distribution-auth-update.md` decision 2 ("It is no longer in `shared/ports`"). |
| E2 `gh` contract real arm POSIX only | kept | A platform limit, not a missing structure: `spawnSync` without a shell resolves no `.cmd` (`native-plugin-cli-adapter.codex.integration.test.ts:11`). |
| E3 auth repeats framework's `Environment` port | removed | Phase 2 moves `contexts/framework/domain/ports/environment.ts` to `shared/ports/environment.ts` and `contexts/framework/infrastructure/environment-adapter.ts` to `shared/infrastructure/environment-adapter.ts` (`target/code-map/src-framework.md:28,37`, `target/00-overview.md:78`). Auth imports the shared port and declares none of its own. |
| E4 `/user` call in `runtime/github/` | removed | Phase 2 splits `HttpGet` into `shared/ports/http-get.ts`, moves `HttpClient` to `shared/infrastructure/http-client.ts` and `runtime/auth/gh-token-adapter.ts` to `shared/infrastructure/`; phase 3 renames it `github-adapter.ts`, `GitHubAdapter` (`target/05-distribution-auth-update.md:179,215`, `target/code-map/src-runtime-kernel-presentation-distribution.md:27,40,52,54`). |
| E5 `CachedTokenProvider` in `application/` | kept | No structure removes it. Only a change to the cited line `target/00-overview.md:62` would, and that is a model revision, which `pilot:385` leaves to the reviewer after the pilot ("The executor does not reclassify an entry to change the verdict"). |
| E6 R1b counts any importer outside the context | kept | Same reason as E5: it deviates from the wording of `target/00-overview.md:63`, not from a missing folder. |
| E7 constructor cap as a Biome plugin scoped to auth | removed | Phase 4 raises the cap of `orchestrator-deps.arch.test.ts` from 4 to 5 (`:9`) and removes the 16 `BASELINE` entries at exactly 5. The cap of commands is then the architecture test at 5 that `target/00-overview.md:102` and `target/08-guardrails-and-repo-map.md:68` cite, applied to every `application/` folder, auth included. The pilot needs no auth-scoped override and no R3. |
| E8 `ports/` in auth, `domain/ports/` elsewhere | kept | Removing it means moving the 39 port files of four contexts (tools 6, framework 5, distribution 6, telemetry 22), about 310 import lines (`grep -rn "domain/ports/" src tests \| grep -c import`). That is moving other contexts, which this PR does not do. |
| E9 auth keeps its own permission code | kept, for a second reason | The shared adoption is a behaviour change, not a missing folder. `PrivateStorage` has no read and no delete (`telemetry/domain/ports/private-storage.ts:2-10`); on Windows auth grants `(R,W)` on the file (`runtime/auth/auth-storage.ts:45`) where the adapter grants `(OI)(CI)F` on the directory and makes it `0700` on POSIX (`runtime/filesystem/private-storage-adapter.ts:41-55`), which applied to auth would change the project `.aidd/` directory. The auth file permissions, Windows ACL included, are frozen surface (`target/00-overview.md:228`). Moving the port alone would also give `shared/ports` a port with one consuming context: its 10 importers are all telemetry (`grep -rln private-storage src`). |

## Migration-state deviations, registered

Deviations from a cited target line that are not among E1 to E9. Two are created by this PR, two existed before it and the pilot did not register them. Each is pre-registered for the pilot (table "What the pilot plan must change afterwards").

| # | Deviation | Cited line | Created by | Survives the pilot | Bounded by |
| --- | --- | --- | --- | --- | --- |
| M1 | `shared/ports/http-get.ts` has one importing context, distribution (`github-raw-fetcher-adapter.ts:12`); its other consumers are `runtime/self-update` (not a context yet) and the GitHub adapter in `shared/infrastructure` | rule 8, `target/00-overview.md:69`; `target/05-distribution-auth-update.md:62` (`HttpGet` consumed by distribution, auth and update) | this PR | yes: auth receives the adapter, it does not import `HttpGet` | update's migration makes it two contexts; until stage C step 4 no computed check exists (`target/08-guardrails-and-repo-map.md:263`) |
| M2 | `shared/ports/environment.ts` has one consumer, framework | rule 8, `target/00-overview.md:69` | this PR | no: the pilot's `CheckStatus` and `CachedTokenProvider` are the second consumer (`pilot:140,148`) | the pilot |
| M3 | auth imports `kernel/` (errors, `Logger`, `AIDD_DIR`) where the target has `shared/` | `target/00-overview.md:20,24` | before this PR | yes | the old-layout counter (`kernel/` path set frozen) |
| M4 | presentation reaches `createDeps` in `runtime/wiring/` where the target has `cli.ts` hand it the container | `target/03-orchestration-composition-presentation-shared.md:123` | before this PR | yes | the old-layout counter (`runtime/` count) |

The pilot's third criterion (exceptions not more than ambiguities removed, `target/00-overview.md:197`), recounted against its 7 ambiguities. An exception, by the pilot's definition, is a deviation the pilot needs and that survives it (`pilot`, "Definitions"), so M2 never counts.

| Reading | Counted | Total | Verdict |
| --- | --- | --- | --- |
| M3 and M4 are migration state the target's own ratchet tracks (`target/08-guardrails-and-repo-map.md` section 2.3), M1 is an exception | E1, E2, E5, E6, E8, E9, M1 | 7 against 7 | passes, at the limit |
| every surviving deviation counts | the 7 above, M3, M4 | 9 against 7 | fails |

The reviewer of the pilot chooses the reading, not the executor (`pilot:385`). Before this PR the same recount gave 9 (or 11) against 7.

The pilot's `wireAuth` was to land in `runtime/wiring/auth.ts` (`pilot:154`), a deviation from `target/code-map/src-runtime-kernel-presentation-distribution.md:15` (`composition/auth.ts`). The pilot now creates `src/composition/auth.ts` together with the guards that make `composition/` known (pilot-change table).

## Boundary of `shared/` and `kernel/`

They coexist after this PR. `kernel/` is the exception (`target/00-overview.md:24`: it disappears).

| | `shared/` (target home) | `kernel/` (old home) |
| --- | --- | --- |
| Receives | every new technology port (`shared/ports`) and its adapter (`shared/infrastructure`); a pure technical type, later (`shared/domain`, created when its first file arrives, never empty) | no new file: the old-layout counter holds its committed path set. A new typed error still goes into the existing `kernel/errors.ts` until stage C (`0-error-handling.md:22`: the one catalog) |
| May import | `kernel/` (the old name of the same layer: `gh-token-adapter.ts:1` and `http-client.ts:4-9` import `kernel/errors.ts`); `shared/ports` never imports `shared/infrastructure` | nothing outside itself; in particular nothing from `shared/`, so the stage C drain of `kernel/` into `shared/` creates no cycle |
| Imported by | contexts, presentation and runtime may import `shared/ports`; only the composition root (`runtime/wiring/` today) imports `shared/infrastructure` (`target/00-overview.md:69`, rule 7) | anyone, as today |
| Imports refused | any context, `presentation/`, `runtime/` (Biome, phase 2) | as today, plus `**/shared/**` (Biome, phase 2) |

Stage C moves `kernel/*` into `shared/domain` and `shared/ports` (`target/code-map/src-runtime-kernel-presentation-distribution.md:55-77`); this PR moves nothing out of `kernel/`.

## Measured baseline

Measured on this branch before any change. Phase 0 re-runs each line into `$B`; a different figure there replaces this one.

| Measure | Value | Command |
| --- | --- | --- |
| Architecture suite | 31 files, 181 tests pass, 625 ms | `sbx ./node_modules/.bin/vitest run --project=architecture` |
| Files under the old layout | `src/runtime` 39, `src/kernel` 25, `src/contexts/framework` 128 (`.ts`, `.d.ts` included) | `find src/runtime -name '*.ts' \| wc -l`, same for the others; phase 0 recounts with `sourceFiles()`, which the counter uses, and lists `kernel/`'s paths |
| Mutation probe of the files that move to `shared/` | `http-client.ts` 86 mutants, 70 killed, 10 timeout, 6 survived (93.02); `environment-adapter.ts` 1 killed; `environment.ts` none; 30 s wall | temp stryker config with these three `mutate` globs, `incremental: false`, run under `sbx` |
| Mutation of `gh-token-adapter.ts` | 39 mutants, all killed (`pilot`, "Mutation of the rest of `runtime`") | pilot baseline |
| `runtime` scope, computed | today 1,015 of 1,109 detected (91.52); after this PR 896 of 984 (91.06); `runtime` without auth after the pilot 625 of 701 (89.16), against the pilot's computed 90.07 | arithmetic on the pilot's measured 705 of 787 (runtime without auth) and 310 of 322 (auth), minus `http-client.ts` (80 of 86) and `gh-token-adapter.ts` (39 of 39); phase 2 measures it |
| `orchestrator-deps` baseline | 39 entries, 16 at exactly 5 | `grep -c "injected:" tests/architecture/orchestrator-deps.arch.test.ts`, `grep -c "injected: 5"` |

### Measured churn, chosen against rejected

| Option | Files touched | Import lines changed | Decided |
| --- | --- | --- | --- |
| HTTP port and client to `shared/` (phase 2) | src 7 (`http-client.ts` moved, `http-get.ts` new, `github-raw-fetcher-adapter.ts:12`, `self-updater-adapter.ts:11`, `github-release-resolver-adapter.ts:8`, `runtime/wiring/distribution.ts:22`, `runtime/wiring/framework.ts:111`); tests 8 (`auth-logout-use-case.integration.test.ts:8`, `gh-token-adapter.unit.test.ts:8`, the two `tests/runtime/http/*` moved, four `tests/runtime/self-update/*`) | 14 (6 src, 8 tests) | yes |
| `gh-token-adapter.ts` to `shared/infrastructure` (phase 2) | src 2 (the file, `runtime/wiring/framework.ts:106`); tests 2 (the unit test moved, `auth-logout-use-case.integration.test.ts:6`) | 4, plus the `oauth-provider` import deleted from the file (`gh-token-adapter.ts:3`) | yes |
| `Environment` port and adapter to `shared/` (phase 2) | src 4 (2 moved, `setup-marketplace-registration-use-case.ts:15`, `runtime/wiring/framework.ts:71,74`); tests 2 (`environment-adapter.unit.test.ts` moved, `tests/helpers/ports/in-memory-environment.ts:1`) | 6 (4 src, 2 tests) | yes |
| Configuration and guards of phase 2 | `biome.json`, `helpers.ts` (`BASELINE` weight), `biome-context-parity`, `biome-guards-bite`, `referenced-paths`, `mutation-scopes.json`, `package.json`, `vitest.config.ts`, `cli/aidd_docs/memory/codebase-map.md`, `.claude/skills/distribution/SKILL.md` | none | yes |
| `runtime/wiring/` moved wholesale to `composition/` | 5 moved; 190 relative import lines inside them; 14 src importers (16 lines: `cli.ts` and 13 `presentation/commands/*`); 30 test files (50 lines, 6 moved); about 15 text files naming the path (rules, skills, memory, `vitest.config.ts:104,116`, `aidd_docs/product/usage-contract.md`); 3 negated includes of `chore/code-size-rules` (`!src/runtime/wiring/framework.ts` in two overrides, `!src/runtime/wiring/telemetry.ts` in one) | about 256 | no (D2) |
| Only the auth part of the wiring extracted now | `framework.ts:102-107,144-145,220-233,614-615`, `distribution.ts:21,29`: a logic change to wiring the pilot characterizes first (pilot C4b to C4d drive the real wiring) | n/a | no: the pilot does it after its characterization (D2) |
| `domain/ports/` to `ports/` in every context | 39 files, about 310 import lines, four contexts | about 310 | no (E8) |

## Target, file by file

### Source (`cli/src/`)

| Current | Target | Action | Phase |
| --- | --- | --- | --- |
| `runtime/http/http-client.ts` | `shared/infrastructure/http-client.ts` and `shared/ports/http-get.ts` | `git mv`; `HttpGetOptions`, `HttpResponse`, `HttpGet` (`http-client.ts:11-24`) moved unchanged into the port file, which `http-client.ts` imports | 2 |
| `runtime/auth/gh-token-adapter.ts` | `shared/infrastructure/gh-token-adapter.ts`, then `shared/infrastructure/github-adapter.ts` | `git mv` (2); `implements TokenAuthProvider` and its import (`:3-4`) removed: shared imports no context, the wiring proves the shape (`runtime/wiring/framework.ts:232` passes it where `TokenAuthProvider` is expected); rename to `GitHubAdapter` (3). No `apiBase` parameter: that is the pilot's logic change, for its contract suite (`pilot:463`) | 2, 3 |
| `contexts/framework/domain/ports/environment.ts` | `shared/ports/environment.ts` | `git mv` | 2 |
| `contexts/framework/infrastructure/environment-adapter.ts` | `shared/infrastructure/environment-adapter.ts` | `git mv` | 2 |
| `contexts/distribution/infrastructure/github-raw-fetcher-adapter.ts`, `runtime/self-update/self-updater-adapter.ts`, `runtime/self-update/github-release-resolver-adapter.ts`, `contexts/framework/application/shared/setup-marketplace-registration-use-case.ts`, `runtime/wiring/distribution.ts`, `runtime/wiring/framework.ts` | same | import specifiers only | 2, 3 |
| `src/composition/` | not created | no file and no guard change: its first file and its guards come with the pilot's `composition/auth.ts` (D2) | none |

Final tree of `shared/`:

```txt
cli/src/shared/
├── ports/environment.ts
├── ports/http-get.ts
├── infrastructure/environment-adapter.ts
├── infrastructure/github-adapter.ts
└── infrastructure/http-client.ts
```

### Tests (`cli/tests/`)

| Current | Target | Phase |
| --- | --- | --- |
| `runtime/http/http-client.integration.test.ts`, `runtime/http/http-client-wire.integration.test.ts` | `shared/infrastructure/` | 2 |
| `runtime/auth/gh-token-adapter.unit.test.ts` | `shared/infrastructure/gh-token-adapter.unit.test.ts`, then `github-adapter.unit.test.ts` | 2, 3 |
| `contexts/framework/infrastructure/environment-adapter.unit.test.ts` | `shared/infrastructure/` | 2 |
| `helpers/ports/in-memory-environment.ts` | same (import only); its target `tests/shared/testing/` (`target/code-map/tests-telemetry-presentation-e2e-helpers-architecture-golden-fixtures.md:103`) moves with the kits, not here | 2 |
| `runtime/auth/auth-logout-use-case.integration.test.ts`, four `runtime/self-update/*` files | same (imports only) | 2, 3 |
| `architecture/old-layout-count.arch.test.ts` | new | 1 |

### Guards and configuration

| File | Change | Phase |
| --- | --- | --- |
| `tests/architecture/helpers.ts` | `contextOf` returns `shared` for `src/shared/` (`:149-156`); the crossings walk skips a target in `shared` as it skips `kernel` (`:186`), so any importer may reach `shared/ports` and the graph sees `shared -> <context>`; `isContext` excludes `shared` (`:161-163`); `BASELINE` `distribution->runtime` from 6 imports in 3 files to 5 in 3 (the `HttpGet` import of `github-raw-fetcher-adapter.ts:12` leaves `runtime`). Nothing about `composition` (SF1) | 1, 2 |
| `tests/architecture/context-graph.arch.test.ts` | "the guard itself": `contextOf` names `shared`; a planted `shared -> tools` crossing is reported, `tools -> shared` is not | 1 |
| `tests/architecture/old-layout-count.arch.test.ts` | new: the committed count of `sourceFiles()` under `src/runtime/` and `src/contexts/framework/`, and the committed path set of `src/kernel/` (25 paths, phase 0). A count differing from its committed value fails, with "lower the committed value" when it went down and "nothing new enters the old layout" when it went up; any path added to `kernel/` fails even if another left (a swap), a path removed fails with "remove it from the committed set" (`target/08-guardrails-and-repo-map.md` section 2.3); deleted when the three folders are gone | 1, 2 |
| `biome.json` | kernel override (index 0): group gains `**/shared/**`. New override `src/shared/ports/**/*.ts`: groups `**/contexts/**`, `**/presentation/**`, `**/runtime/**`, `**/infrastructure/**`. New override `src/shared/infrastructure/**/*.ts`: groups `**/contexts/**`, `**/presentation/**`, `**/runtime/**`. The five `src/contexts/*/infrastructure/**` overrides gain `**/shared/infrastructure/**` (domain and application already refuse `**/infrastructure/**`). New override `src/presentation/**/*.ts` and new override `src/runtime/**/*.ts` with `!src/runtime/wiring/**`, each refusing `**/shared/infrastructure/**`. `noRestrictedGlobals` (index 18) gains `src/shared/ports/**/*.ts`, and its message (`:555`) names `shared/ports/environment.ts` instead of `framework/domain/ports/environment.ts`. The `no-process-exit` override (index 19) gains `src/shared/**`. New overrides sit right after the kernel override, away from the tail where `chore/code-size-rules` inserts its six (after the unit-test override) | 2 |
| `tests/architecture/biome-context-parity.arch.test.ts` | `genericLayerTargets("infrastructure")` (`:64-70`) expects the raw pattern `**/shared/infrastructure/**`; the kernel case (`:150-160`) expects `shared` too; a new case holds both `shared` overrides to their groups | 2 |
| `tests/architecture/biome-guards-bite.arch.test.ts` | the pinned includes of the exit plugin and of `noRestrictedGlobals` follow; planted trees: a `src/shared/ports/x.ts` importing `../../contexts/tools/domain/registry.js` reported; a `src/contexts/tools/infrastructure/x.ts`, a `src/presentation/display/x.ts` and a `src/runtime/self-update/x.ts` importing `shared/infrastructure/http-client.js` reported; a `src/runtime/wiring/x.ts` doing the same clean; a `src/shared/ports/x.ts` reading `process.env` reported; a `src/shared/infrastructure/x.ts` calling `process.exit` reported | 2 |
| `tests/architecture/referenced-paths.arch.test.ts` | `CITED_PATH` (`:19-20`) gains `shared` among the bare top-level areas, so a rule citing `shared/ports/http-get.ts` is checked like one citing `kernel/errors.ts`; its "guard itself" gains a dead `shared/gone.ts` case, red before the regex changes | 2 |
| `tests/architecture/orchestrator-deps.arch.test.ts` | `MAX_INJECTED_USE_CASES` renamed `MAX_CONSTRUCTOR_DEPENDENCIES`, 4 to 5 (`:9`); `injectedUseCaseCount` renamed `constructorDependencyCount`; the describe and `it` titles name a constructor-dependency cap ("no command takes more than 5 dependencies, injected or instantiated"); the 16 entries at `injected: 5` removed, the field renamed `dependencies` | 4 |
| `mutation-scopes.json`, `package.json` | new scope `shared`, `"mutate": "src/shared/**/*.ts"`, `break` = the integer part of the score measured in phase 2 (computed 95.24: 120 of 126); script `test:mutation:shared` (required by `mutation-covers-source.arch.test.ts`); `runtime` and `framework` floors unchanged | 2 |
| `vitest.config.ts` | coverage `exclude` gains `src/shared/ports/**` (ports have no body, the reason at `:104`) | 2 |
| `cli/aidd_docs/memory/codebase-map.md` | tree gains `shared/` with `ports/` and `infrastructure/`, loses `runtime/http/` (held both ways by `codebase-map.arch.test.ts`); areas and "Where to add things" rewritten in phase 4 | 2, 4 |
| `cli/.claude/skills/distribution/SKILL.md:14` | "it depends on `kernel` only" becomes "on `kernel` and `shared/ports` only" (the `HttpGet` import moves) | 2 |

What this PR does not touch, on purpose: anything naming `composition/`, whether a guard, a Biome group, a coverage exclude, a mutation entry or rule text (D2, SF1); `earned-sharing.arch.test.ts` (SF2); any `contexts/<name>/{contract,ports}` data (D12); `PrivateStorage` (E9); the forge ports `RepositoryReader` and `ReleaseLister` (D3); `kernel/` files (boundary above); `scripts/mutation-scopes-to-run.mjs`, which `chore/mutation-triggers` rewrites (the new scope is picked up from its glob, `mutation-scopes-to-run.mjs:23-36`).

## Conventions content (phase 4)

The guideline items of `target/00-overview.md:164`: 7a `0-orchestration.md`, 7b `0-shared-modules.md` and 7c `0-contexts.md` land here; 7d `0-deps-wiring.md` lands in the pilot with the first file of `composition/`. Each is merged or scoped, never doubled (root `CLAUDE.md`, "check whether an existing one already covers or contradicts it"). Relocating the rules to `.claude/rules/cli-architecture.md` (`target/code-map/harness-and-repo.md:50-54`) stays the guideline PR's.

| Rule | Today | After |
| --- | --- | --- |
| `0-orchestration.md` (7a) | "Four other use cases at most" (`:11`), description "four at most" (`:2`) | "Five dependencies at most, injected or instantiated (`new XUseCase(...)`), counted by `orchestrator-deps.arch.test.ts` with its per-file counts." The description says "five at most". The judgment lines (entry point, one dependency per area, steps inside the area) stay. No sentence about `0-code-size.md` here: it, and the code-size branch's own line "for a use case the four above is stricter and applies", go to whichever PR lands second (D9) |
| `0-shared-modules.md` (7b) | "shared/ needs callers in two areas" (`:9`), written for `application/shared/` inside a context; "Move to `kernel/` only once it stops being business logic" (`:18`); `paths:` `src/contexts/**/*.ts` only (`:3-4`) | two scoped rules, in this order: (1) `src/shared/`: a module enters when two contexts consume it, by import or by being handed its adapter by the composition root; until the computed check exists (stage C step 4, `target/08-guardrails-and-repo-map.md:263`) the PR that admits a module names its consumers and registers a module short of two as a migration-state deviation (M1, M2); (2) a `shared/` directory inside a context (today only `contexts/framework/application/shared/`, 13 files): callers in two areas, held by `earned-sharing.arch.test.ts`, until framework splits. `target/00-overview.md:244` ("replaces") becomes true only then. Line 18 becomes "Move to `shared/` only once it stops being business logic; `kernel/` receives no new file". `paths:` gains `src/shared/**/*.ts` |
| `0-contexts.md` (7c) | "Arrows run one way, toward the kernel" (`:14`); "A port two contexts need lives in `kernel/ports/`" (`:24`), kernel as the shared vocabulary (`:20-25`) | line 14: "toward `shared/` and the kernel". Kernel section: "`kernel/` is the old home of the shared vocabulary: no new file enters it (`old-layout-count.arch.test.ts` holds its path set); a new typed error still goes into its `errors.ts` until stage C. It imports no context and nothing from `shared/`. A technology port two contexts need goes to `shared/ports/`, its adapter to `shared/infrastructure/`, which only the composition root imports. A domain decision is never shared material." |
| `0-deps-wiring.md` (7d) | "One wiring module per context under `runtime/wiring/`" (`:18`); `paths:` names `runtime/wiring` only | unchanged in this PR. `referenced-paths.arch.test.ts` reads `.claude/rules` whole, frontmatter included (`:35-37`, `CITED_PATH` at `:19-20`), and fails on `src/composition` while the folder is empty. The pilot's phase that creates `composition/auth.ts` rewrites it (pilot-change table) |
| `0-hexagonal.md` (contradicts the above, so it changes too) | "One context: `domain/ports/`. Two: `kernel/ports/`." (`:26`), "`runtime/` for a kernel port" (`:27`) | only the two-context half changes: "Two: `shared/ports/`." and "`shared/infrastructure/` for a shared port". "One context: `domain/ports/`" stays: loosening it to fit auth's `ports/` would reword E8 away, which this PR refuses for E5 and E6 as well; the pilot changes it when auth introduces `ports/`. `paths:` gains `src/shared/**/*.ts` |
| `03-frameworks-and-libraries/3-cli-process.md:35` | "Nothing under `contexts/`, `kernel/`, `runtime/` calls `process.exit`" | adds `shared/`, matching the plugin's includes |
| `cli/ARCHITECTURE.md:24,41` | `src/kernel/` holds "ports shared by two contexts or more"; "What the kernel may know" points at `earned-sharing.arch.test.ts` | a `src/shared/` row (technology ports and their adapters, imported by the composition root only for `infrastructure/`); the kernel row loses "ports shared by two contexts or more" and says "old home, receives no new file"; line 41 names the old-layout counter for what the kernel may hold |
| `cli/aidd_docs/memory/codebase-map.md:89-91,114-117,125,137-138` | the tree annotates `kernel/` "shared vocabulary" and its `ports/` "a port two or more contexts both need"; the table sends a two-context port to `kernel/ports/`, adapter in `runtime/` | tree: `kernel/` annotated "old home of the shared vocabulary, receives no new file", its `ports/` annotation dropped; areas `src/shared/` and `src/kernel/` described once; "a port used by two: `shared/ports/`, adapter in `shared/infrastructure/`" |
| `cli/aidd_docs/memory/architecture.md` (mermaid, `:15-33`) | no `shared` | `Shared["shared"]` beside `Kernel`, reached by the contexts that import it |

## Decisions

| # | Decision | Why (evidence) |
| --- | --- | --- |
| D1 | `PrivateStorage` stays in telemetry; E9 is kept with a second reason | No read and no delete in the port (`private-storage.ts:2-10`); different Windows grant and directory mode (`auth-storage.ts:45` against `private-storage-adapter.ts:41-55`); frozen surface (`target/00-overview.md:228`); one consuming context today (10 importers, all telemetry). Adoption is a behaviour PR of its own, with a write test of the file mode (`target/05-distribution-auth-update.md` decision 4 names that cost) |
| D2 | `runtime/wiring/` is not moved and `composition/` is not touched; its first file, its guards and its rule text come with the pilot's `composition/auth.ts` | Cost measured above (about 256 import lines, 3 stale `chore/code-size-rules` includes). A wholesale move turns 14 counted old-layout importers into violations of "presentation never imports composition" (`target/03-orchestration-composition-presentation-shared.md:123`). Biome groups, coverage excludes, mutation exclusions and rule citations cannot name an empty folder: `import-rules-bite.arch.test.ts:58-66`, `referenced-paths.arch.test.ts:19-20,42`, `mutation-covers-source.arch.test.ts:73-77`; a graph helper taught an empty folder proves nothing on the real tree (SF1) |
| D3 | No `RepositoryReader` or `ReleaseLister` yet; the GitHub adapter holds only `verifyToken` | Their consumers, distribution and update, are not migrated; a port with no caller fails `ports-are-called.arch.test.ts`; "never share for a caller not yet written" (`0-shared-modules.md:11`); implementing them merges `github-release-resolver-adapter.ts` (`target/code-map/src-runtime-kernel-presentation-distribution.md:51`), a logic change in update's PR |
| D4 | `HttpGet` in `shared/ports/http-get.ts`, `HttpClient` in `shared/infrastructure/http-client.ts`, registered as M1 | `target/code-map/src-runtime-kernel-presentation-distribution.md:27,54`; `target/03-orchestration-composition-presentation-shared.md:110`; importers `github-raw-fetcher-adapter.ts:12`, `self-updater-adapter.ts:11`, `github-release-resolver-adapter.ts:8`, `gh-token-adapter.ts:2`; one importing context today (M1) |
| D5 | `gh-token-adapter.ts` moves into `shared/infrastructure` in this PR and drops `implements TokenAuthProvider` | `shared/infrastructure` may import no context (`target/00-overview.md:79`: "satisfies the `auth` port by shape without importing `auth`"); the typecheck at `runtime/wiring/framework.ts:232` holds the shape; it is the only `HttpGet` consumer the pilot needs placed, and placing it here keeps the pilot's phase 3 to the auth storage seam |
| D6 | `Environment` and its adapter move now, registered as M2 until the pilot | The pilot keeps one context per PR (`target/00-overview.md:201`); its second consumer is the pilot's `CheckStatus` and `CachedTokenProvider` (`pilot:140,148`). The computed two-context check enters in stage C step 4 (`target/08-guardrails-and-repo-map.md:263`), not with the pilot: it would still fail on M1 |
| D7 | `kernel/` is the exception and the frozen old home: no new file, its path set held by the counter; a new typed error still goes into `kernel/errors.ts` until stage C; `shared/` may import it, never the reverse | `target/00-overview.md:24`; `0-error-handling.md:22` (one catalog); `gh-token-adapter.ts:1` and `http-client.ts:4-9` import `kernel/errors.ts`; a count alone lets a delete plus an add pass (SF4) |
| D8 | The command cap moves from 4 to 5 in `orchestrator-deps`, renamed to a constructor-dependency cap, not into a second mechanism | `target/00-overview.md:102,243`; `target/08-guardrails-and-repo-map.md:68` (an architecture test on `application/` constructors); `orchestrator-deps.arch.test.ts:146-156` already counts every parameter plus inline `new XUseCase(`; 16 entries at 5 leave, a removal only |
| D9 | `chore/code-size-rules` is not stacked; whichever PR lands second applies the one shared `0-orchestration.md` hunk | Coordinator decision. The two PRs share one rule-text hunk: the code-size branch adds "for a use case the four above is stricter and applies" after `0-orchestration.md:12`, this PR rewrites `:11`. The PR landing second deletes that line and adds "Every constructor is also capped at five parameters by `0-code-size.md`, outside the commands this rule caps (D14)." Nothing else is shared: this PR moves no file the code-size baselines name (they name `runtime/wiring/framework.ts`, `runtime/wiring/telemetry.ts`, `runtime/prompter/prompter-adapter.ts` and `kernel/` files), and its new `biome.json` overrides sit at the head, the code-size ones at the tail |
| D10 | A new mutation scope `shared` with a measured floor, not an extension of `kernel` | `http-client.ts` measures 93.02, under `kernel`'s floor of 95 (`mutation-scopes.json`); `target/00-overview.md:144` names `shared` the target scope; the two merge when `kernel/` drains |
| D11 | `0-shared-modules.md` gets two scoped rules, not one merged rule | `contexts/framework/application/shared/` holds 13 files judged by areas (`earned-sharing.arch.test.ts:12-31,37-39`); "two contexts" cannot be true of a directory inside one context |
| D12 | No data for `contexts/<name>/{application,contract,ports}` in this PR | `PUBLIC_MODULES` keys must equal the contexts on disk (`context-boundary.arch.test.ts:218-225`); a Biome group naming `auth/contract` fails `import-rules-bite` until the folder exists; a rule enters with the PR that makes it true (`target/08-guardrails-and-repo-map.md` section 2.3). The pilot's R1, R1b, R5 and R6 stay its own |
| D13 | Shared's purity rule (no builtin, no third party in `shared/ports`) waits for the pilot's R4 lists | the lists are computed from `package.json` and `builtinModules` in the pilot (`pilot`, R4); `shared/ports` holds two interface files with no import; extending R4's includes to `src/shared/ports/**` is one glob in the pilot |
| D14 | One owner for the command constructor cap: `orchestrator-deps.arch.test.ts` at 5, on `src/contexts/*/application/**`. When `chore/code-size-rules` lands, its constructor plugin is kept and explicitly scoped to everything else: its override's `includes` gain `!src/contexts/*/application/**` and `0-code-size.md` says "A constructor outside a context's `application/` takes at most 5 dependencies; commands are capped by `orchestrator-deps`" | dropping the plugin would leave adapters and runtime classes uncapped, which no other guard covers; scoping it removes the overlap. The arch test keeps what the plugin cannot do: per-file counts and the inline `new XUseCase(` count (`orchestrator-deps.arch.test.ts:146-156`). The application files in the plugin's 21-file baseline leave it, since the plugin no longer sees them; the ceiling in `code-size.arch.test.ts` is lowered, never raised |

## Phases

| # | Phase | Model | Depends on |
| --- | --- | --- | --- |
| 0 | Baseline | haiku | none |
| 1 | Graph and counter know `shared/` | sonnet, opus reviews the guards | 0 |
| 2 | Move into `shared/`, names unchanged, with its rules | sonnet, opus reviews the Biome data | 1 |
| 3 | Rename the GitHub adapter | sonnet | 2 |
| 4 | Conventions and the command cap | opus writes the rule text, sonnet edits | 3 |
| 5 | Gates and after measures | haiku runs, opus judges | 4 |

### Phase 0: Baseline (haiku)

Files: none in the repository. Into `$B`: the architecture suite (files, tests, duration); the old-layout counts of `src/runtime/` and `src/contexts/framework/` and the path list of `src/kernel/`, through `sourceFiles()` (`node -e` importing `scripts/mutation-shards.mjs`'s `sourceFiles`); `sbx node scripts/run-mutation.mjs runtime --force` and `... framework --force` (score and wall time, the base of the computed 91.06 and of the framework figure of phase 5); the probe of the baseline table rerun; `grep -c "injected: 5"` on `orchestrator-deps.arch.test.ts`.

Acceptance:

```sh
ls "$B"            # each output above
git status --short # expected: the untracked pilot plan and this plan, nothing else
```

### Phase 1: Graph and counter know `shared/` (sonnet; opus reviews the guards)

Files: `tests/architecture/helpers.ts` (`contextOf`, `isContext`, the crossings skip), `context-graph.arch.test.ts`, `old-layout-count.arch.test.ts` (new, committed counts and `kernel/` path set = phase 0).

Each guard case is written red first: with the helper unchanged, `contextOf("src/shared/ports/x.ts")` is `outside` and the planted `shared -> tools` crossing is skipped (`helpers.ts:186`), so the case fails; the change makes it pass. The counter's own cases: a planted count one above the committed value fails with "nothing new enters", one below with "lower the committed value"; a planted `kernel/` set with one path removed and another added fails although the count is equal.

Acceptance:

```sh
cd cli && sbx ./node_modules/.bin/vitest run --project=architecture   # expected: 32 files pass; 181 tests plus the cases added, the total written to $B/arch-phase-1.txt
pnpm typecheck && pnpm lint                                           # expected: green
```

### Phase 2: Move into `shared/`, names unchanged, with its rules (sonnet; opus reviews the Biome data)

Order inside the phase, each step typechecked before the next: `git mv` the four source files and the four test files; create `shared/ports/http-get.ts` from `http-client.ts:11-24`; delete the `implements` clause and the `oauth-provider` import of `gh-token-adapter.ts`; rewrite the import lines of the churn table; then the configuration and guards of the "Guards and configuration" table marked 2, Biome planted trees and the `CITED_PATH` case written and run red against the old files first; the counter lowered (`runtime` minus 2, `framework` minus 2, `kernel/` set unchanged); `BASELINE` `distribution->runtime` to 5 in 3; the `shared` scope's floor set from its measured run; `SKILL.md:14` and the `noRestrictedGlobals` message follow.

Acceptance:

```sh
cd cli && test ! -e src/runtime/http && test ! -e src/runtime/auth/gh-token-adapter.ts \
  && test ! -e src/contexts/framework/domain/ports/environment.ts \
  && test ! -e src/contexts/framework/infrastructure/environment-adapter.ts && echo moved
grep -rn "runtime/http\|domain/ports/environment\|framework/infrastructure/environment-adapter\|runtime/auth/gh-token" src tests biome.json .claude   # expected: nothing
grep -rn 'from "' src/shared | grep -E "contexts/|presentation/|runtime/"   # expected: nothing (import lines only, comments may name a context)
sbx pnpm test:unit && sbx pnpm test:contract && sbx pnpm test:integration   # expected: green, same counts as phase 0
sbx pnpm test:arch   # expected: green; the total of $B/arch-phase-1.txt plus the parity, planted Biome and CITED_PATH cases phase 2 adds
pnpm typecheck && pnpm lint && pnpm knip && (cd .. && node scripts/check-cli-type-honesty.mjs)    # expected: green
sbx node scripts/run-mutation.mjs shared --force    # expected: at or above its floor (computed 95.24)
sbx node scripts/run-mutation.mjs runtime --force   # expected: at or above 90 (computed 91.06)
CHANGED=cli/src/shared/ports/http-get.ts node scripts/mutation-scopes-to-run.mjs   # expected: names the shared scope
```

A `runtime` score under 90 is answered before the phase is green by tests that kill named survivors of the report, each seen red against its mutant; the floor is not lowered (`mutation-scopes.json` `$comment`; `pilot` D11).

### Phase 3: Rename the GitHub adapter (sonnet)

`git mv src/shared/infrastructure/gh-token-adapter.ts src/shared/infrastructure/github-adapter.ts`, class `GitHubAdapter`; the test file follows (`github-adapter.unit.test.ts`), describe titles name `GitHubAdapter`; importers: `runtime/wiring/framework.ts:106,232`, `auth-logout-use-case.integration.test.ts:6`.

Acceptance:

```sh
cd cli && grep -rn "GhTokenAdapter\|gh-token-adapter" src tests aidd_docs/memory .claude ARCHITECTURE.md   # expected: nothing (aidd_docs/tasks holds records, not instructions)
sbx npx vitest run tests/shared tests/runtime/auth tests/runtime/self-update && pnpm typecheck && pnpm lint   # expected: green
```

### Phase 4: Conventions and the command cap (opus writes the rule text; sonnet edits)

Files: every row of "Conventions content" except `0-deps-wiring.md`, which waits for the pilot; `orchestrator-deps.arch.test.ts` (renamed constant, function and titles, cap 5, 16 entries removed). The cap change is proven before the entries go: with the constant at 5 and the entries kept, the ratchet's "fixed" assertion lists exactly the 16 files at 5 (red for the reason it names); removing them makes it green. The rename is a separate step before the cap change, green on its own.

Acceptance:

```sh
cd cli && grep -c "dependencies:" tests/architecture/orchestrator-deps.arch.test.ts   # expected: 23
grep -n "MAX_INJECTED_USE_CASES\|injectedUseCaseCount" tests/architecture/orchestrator-deps.arch.test.ts   # expected: nothing
grep -rn "kernel/ports\|ports shared by two" .claude aidd_docs/memory ARCHITECTURE.md biome.json   # expected: nothing (the new text names kernel/ without its ports/)
sbx pnpm test:arch   # expected: green
cd .. && pnpm exec lefthook run pre-commit --all-files --force   # expected: green; markdown links, referenced paths, doc duplication, context imports and the cli jobs run, not skipped
```

### Phase 5: Gates and after measures (haiku runs; opus judges)

1. `pnpm exec lefthook run pre-commit --all-files --force`; `pnpm exec lefthook run pre-push --all-files --force` (its output lists the `cli` jobs as run); `cd cli && sbx pnpm test && sbx pnpm test:coverage && pnpm build && pnpm jscpd`.
2. After measures into `$B/after-*`: architecture suite; old-layout counts (expected `runtime` and `framework` each 2 lower, the `kernel/` set unchanged); the `runtime` score; the `framework` score after `environment-adapter.ts` left it (`sbx node scripts/run-mutation.mjs framework --force`, against phase 0); the `shared` score per file, from the scope's JSON report: `http-client.ts` (probe: 93.02, 70 killed, 10 timeout, 6 survived), `github-adapter.ts` (39 of 39 expected), `environment-adapter.ts` (1 of 1); `git diff --stat` against the phase 0 base, with files and import lines compared to the churn table (a difference over 20 % is explained in the PR body). The PR body states the per-file `shared` scores, the `runtime` and `framework` scores before and after, and M1 and M2.
3. Behaviour neutrality: the pilot's characterization does not exist yet, so neutrality is read from the unchanged e2e and golden suites (part of `sbx pnpm test`) and from the diff: no line of `src/` changes outside import specifiers, the `implements` clause, the extracted declarations and the class name (`git diff -U0 -- src | grep '^[+-]' | grep -v '^[+-]\s*import\|^[+-]\s*} from\|^[+-][+-]'` read by opus).
4. `git status --short`: only the planned files; nothing committed.

## What the pilot plan must change afterwards

| Pilot place | Change |
| --- | --- |
| Exceptions table and line 385 | E3, E4 and E7 removed (this PR). E9 gains its second reason (D1). The reviewer still owns E5 and E6 |
| Exceptions table, new rows | Pre-registered before execution: M1 (`HttpGet` with one importing context, survives the pilot), M2 (`Environment`, closed by the pilot's own `CheckStatus` and `CachedTokenProvider`, so it never counts), M3 (auth imports `kernel/`), M4 (presentation reaches `createDeps`). The third criterion, recounted openly: 7 against 7 (passes, at the limit) if M3 and M4 are migration state held by the old-layout counter; 9 against 7 (fails) if every surviving deviation counts. The reviewer chooses the reading before execution and writes it in the pilot |
| Rule R3, D9, E7, SF7, reference section 3 | Deleted: `orchestrator-deps` caps every `application/` at 5, auth's commands included; the template and the test say 5; the cap's owner is that test (D14) |
| D2, D3, phase 3, file table rows of `gh-token-adapter.ts` and `ports/environment.ts`, final trees | Phase 3 keeps only the `AuthStorage` seam and adds the `apiBase` parameter to `shared/infrastructure/github-adapter.ts` (logic, for the phase 8 contract suite); `tests/runtime/github/` becomes `tests/shared/infrastructure/github-adapter.unit.test.ts`; auth imports `shared/ports/environment.ts` and declares no `ports/environment.ts`, so the context holds 14 source files and `ports/` 4 |
| `wireAuth` (row 154, tree line 178, phases 6.4 and 6.7) | Lands in `src/composition/auth.ts`, called by `runtime/wiring/framework.ts`. The pilot's phase that creates it also adds, each with its planted violation: `contextOf` returning `composition` and `composition` in `BELOW_NOTHING` (`helpers.ts:149-159`), with `tools -> composition` reported and `composition -> tools` clear; `isCompositionRoot` accepting `src/composition/` (`context-boundary.arch.test.ts:173-175`); `areaOf` mapping it to `composition-root` (`earned-sharing.arch.test.ts:15`); `**/composition/**` in every context, `shared/` and `kernel/` override and in the parity test's expected targets; `src/composition/**` in the coverage exclude of `vitest.config.ts` and in `mutation-scopes.json` `excluded` with the reason of `vitest.config.ts:104` (composition is driven by the in-process and e2e tests the mutation run leaves out, `vitest.mutation.config.ts:9-33`); and 7d: `0-deps-wiring.md` rewritten (the composition root is `runtime/wiring/`, old layout, and `composition/`, target; a new context's wiring module goes to `composition/<context>.ts`; `runtime/wiring/framework.ts` composes them until the root moves; only the composition root instantiates an adapter; `paths:` gains `src/composition/**/*.ts`) and the `composition/` line of `0-contexts.md`'s chain |
| `0-hexagonal.md:26` | The pilot rewrites "One context: `domain/ports/`" when auth introduces `ports/`, naming the coexistence it records as E8 |
| R4 | Its `noRestrictedImports` paths also cover `src/shared/ports/**` (D13) |
| R2 and phase 4 `BASELINE` weights | `distribution->runtime` starts at 5 in 3 (not 6 in 3) and ends at 3 in 2 (`github-raw-fetcher-adapter.ts` keeps no `runtime` import once `TokenProvider` leaves); `framework->runtime` unchanged, 8 in 7 to 6 in 6 |
| Phase 4 | Lowers the old-layout counter: `runtime` minus the 12 files left in `runtime/auth` |
| Baseline (D11, mutation of the rest of `runtime`) | `runtime` without auth computes to 89.16 (625 of 701), not 90.07: about 6 more survivors to kill to hold 90, measured in the pilot's phase 1. The pilot's test counts lose `gh-token-adapter.unit` (moved here): its phase 1 re-measure replaces 138 tests, 13 files and 1,872 lines |

`size_check` and the pilot's phase 7 baseline note are unchanged: `chore/code-size-rules` is not in the stack (D9).

## Resources

| Source | Verified |
| --- | --- |
| `git show chore/code-size-rules:cli/biome.json` and `git diff` of its `0-orchestration.md` | the constructor plugin and its 21-file baseline; negated includes name `src/runtime/wiring/framework.ts` (two overrides), `src/runtime/wiring/telemetry.ts`, kernel files and `src/runtime/prompter/prompter-adapter.ts`, none of the files this PR moves; it adds one line to `0-orchestration.md` |
| Stryker 9 probe on `http-client.ts`, `environment-adapter.ts`, `environment.ts` | 87 mutants, 6 survivors, all in `http-client.ts` (lines 31, 49 twice, 55, 60, 99) |
| vitest architecture project, sandboxed | 31 files, 181 tests, green |

## Risks and limits

- M1 and M2 (section "Migration-state deviations"): `shared/ports` holds two modules short of two importing contexts. If the pilot is a no-go, the PR that abandons it moves `environment.ts` back or names its second consumer; M1 waits for update's migration.
- `src/shared/**` has no computed sharing check until stage C step 4 (`target/08-guardrails-and-repo-map.md:263`): `earned-sharing.arch.test.ts` stays untouched and its regex (`:37-39`) does not see nested `shared/ports` files. The scoped rule text and the admitting PR's named consumers stand in for it.
- The kernel-to-shared one-way rule is held by Biome on `kernel/` and the counter's path set; nothing forbids a context from importing an existing `kernel/ports` file for a new need: the counter stops a new file, not a new importer. The rule text says where a new port goes; the review grid holds it.
- No rule names `composition/` until the pilot: `referenced-paths.arch.test.ts` reads rules whole and refuses a path that does not exist. Until then an agent wiring a new context reads only `0-deps-wiring.md`'s `runtime/wiring/` wording; the pilot is the first PR that wires a new context.
- Not stacking `chore/code-size-rules` leaves one rule-text hunk to the PR that lands second (D9) and the plugin's scoping to that PR too (D14).
- `cli/biome.json` has no root `noRestrictedImports` (its root `style` holds only `noExportedImports`), so the new overrides on `src/presentation/**`, `src/runtime/**` and `src/shared/**` replace nothing (Biome keeps the last matching override, `biome-context-parity.arch.test.ts:1-4`).
- Behaviour neutrality rests on the existing suites and a diff read (phase 5 step 3): no characterization is added, since nothing but import paths, one type clause and one class name change in `src/`.
