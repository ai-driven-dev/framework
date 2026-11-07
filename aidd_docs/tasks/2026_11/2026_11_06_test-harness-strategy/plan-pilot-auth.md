---
objective: "`cli/src/runtime/auth` is the context `cli/src/contexts/auth` in the target shape (domain, ports, application, infrastructure, contract), its tests are rewritten to the target strategy through a recorded test challenge pass, the rules of the pilot are in force with a planted tree each, the credential file is created owner-only, `reference-context.md` is extracted from the result, and the before and after measures decide go or no-go, with no other product behaviour changed."
status: pending
---

# Plan: stage B, the `auth` pilot

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Move `runtime/auth` into `contexts/auth` in the target shape, rewrite its tests to the target strategy with a recorded challenge pass, put the pilot's rules in force for it, close the credential-file permission window, write the strict reference every other context follows, and measure whether the model earns stage C. |
| **Source** | Text request (stage B pilot), grounded in `target/00-overview.md` sections 2 to 7, 10 to 12 (stage B), 14 and 15; `target/05-distribution-auth-update.md` section 2 and decisions 1, 2 and 4; `target/07-test-architecture.md` sections 1, 2, 9 and 10; `target/08-guardrails-and-repo-map.md` sections 2, 4, 5 and 7; the auth rows of `target/code-map/`; the independent challenge of this plan (section "Changes after challenge"); and `plan-foundations.md` (section "What the pilot plan must change afterwards"), whose branch `refactor/foundations` this branch now sits on (section "Changes after foundations"). The code below was read on branch `refactor/auth-pilot` and wins wherever a target document disagrees with it. |

Conventions of this plan:

- Every path is relative to the repository root unless it follows a `cd cli`. Line references to `target/*` documents are to the files under `aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/target/`.
- `$B` is the baseline directory of phase 1 and `$SBX` the sandbox every measured run uses. Each phase starts with:

  ```sh
  B="${TMPDIR:-/tmp}/aidd-auth-pilot-baseline"; mkdir -p "$B"
  SBX="$(mktemp -d "${TMPDIR:-/tmp}/aidd-auth-pilot-XXXX")"; mkdir -p "$SBX/home" "$SBX/cfg"
  sbx() { env -u AIDD_TOKEN -u GH_TOKEN -u GITHUB_TOKEN HOME="$SBX/home" AIDD_USER_CONFIG_DIR="$SBX/cfg" "$@"; }
  ```

- Safety, for every phase: no `aidd`, no `node dist/cli.js` and no `pnpm smoke` by hand. `scripts/smoke-tools.sh:158` reads `gh auth token` from the real home before it relocates `HOME`, so the smoke runs in CI only (`cli-smoke`). Every vitest and stryker run goes through `sbx`. The vitest global setup already relocates `HOME` (`tests/helpers/throwaway-profile.ts:6-12`); `sbx` adds the token variables and the user config directory on top, for stryker and for any script.
- Nothing is committed by this plan. Each phase, and each step of phase 6, ends green, in the order the migration rules require: behaviour frozen first, move before rename, rename before logic change (`target/00-overview.md` section 12, `target/08-guardrails-and-repo-map.md` section 7). The one behaviour change, the owner-only creation of the credential file, is its own step (phase 2b), characterized and red first.
- The code-size rules of branch `chore/code-size-rules` are not in this stack. The new code must satisfy them anyway; `size_check` applies that branch's own rule settings to the files the pilot writes, in a temp copy:

  ```sh
  size_check() { # usage: size_check <paths relative to cli/>; works from any directory
    R="$(git rev-parse --show-toplevel)"; T="$(mktemp -d "${TMPDIR:-/tmp}/aidd-size-XXXX")"
    git -C "$R" show chore/code-size-rules:cli/biome.json | node -e 'const b=JSON.parse(require("fs").readFileSync(0,"utf8"));b.overrides=b.overrides.filter(o=>/noExcessive|max-(constructor|function)-params|no-process-exit/.test(JSON.stringify(o))).map(o=>({...o,includes:o.includes.filter(i=>!i.startsWith("!"))}));delete b.files;console.log(JSON.stringify(b))' > "$T/biome.json"
    mkdir -p "$T/biome-plugins"
    for p in max-constructor-params max-function-params no-process-exit; do git -C "$R" show "chore/code-size-rules:cli/biome-plugins/$p.grit" > "$T/biome-plugins/$p.grit"; done
    for f in "$@"; do mkdir -p "$T/$(dirname "$f")"; cp "$R/cli/$f" "$T/$f" || { echo "SIZE_CHECK: missing cli/$f"; rm -rf "$T"; return 1; }; done
    (cd "$T" && node "$R/cli/node_modules/@biomejs/biome/bin/biome" lint --reporter=github . 2>&1) \
      | grep -oE 'title=(lint/complexity/noExcessive[A-Za-z]+|lint/style/noExcessive[A-Za-z]+|plugin),file=[^,]+' \
      | sed -E 's#file=.*/aidd-size-[^/]+/#file=#' | sort -u
    rm -rf "$T"
  }
  ```

  Expected output for the pilot's files: nothing. Proven to bite, from `cli/`: on `src/presentation/commands/auth.ts` it reports `noExcessiveCognitiveComplexity` and `noExcessiveLinesPerFunction`; on a planted `src/contexts/auth/domain/plant.ts` holding a 6-parameter constructor, a 4-parameter function and a `process.exit`, it reports three `plugin` findings (Biome titles a plugin diagnostic `plugin`, not `lint/...`), so the constructor plugin and the `process.exit` plugin both apply to one file under `auth/`. A missing file fails loudly instead of linting an empty tree.

## Changes after challenge

An independent challenge returned "execute with changes". Every item was applied; none was rejected. Each line names where the plan changed and the evidence.

| Item | Change | Evidence |
| --- | --- | --- |
| DB1 | Phase 6 is split into seven steps, each with its own acceptance command; the level-keyed repository is added beside the path-keyed one (a second port the same adapter implements), callers switch in steps 6.4 and 6.5, the old methods and port go last (6.6) | the old methods have callers until 6.5: `auth-provider-adapter.ts:26,31,38-51`, `auth-reader-adapter.ts:42-46`, `tests/helpers/auth.ts:13-15` |
| DB2 | Phase 3 measures `runtime` with `!src/runtime/auth/**` through a temp stryker config (`run-mutation.mjs runtime` would still mutate auth there); `runtime` and `auth` are re-run at the end of phase 6 and 8. Floor decided now: never lowered in the pilot; a run under the floor is answered by tests that kill named survivors before the phase is green. `github-adapter.unit` is kept by the relevance rule (its cases exist nowhere else), not for the floor arithmetic | `scripts/run-mutation.mjs:28-43` mutates the declared globs; in-process tests leave the mutation run (`vitest.mutation.config.ts:16-35`), so `runtime/wiring/auth.ts` is mutated by nothing that drives it; the default base URL is asserted only at `tests/shared/infrastructure/github-adapter.unit.test.ts:28` |
| DB3 | Exception and ambiguity redefined with citations and re-listed before execution: 9 exceptions (E1 to E9) against 7 ambiguities, since recounted to 7 against 7 (section "Changes after foundations") (A1 to A4, A6 to A8); the earlier E1 (`LogOut.execute()` with no input) is the command template itself; the credential-source cost is measured, not listed: a `GH_TOKEN` source implemented in a throwaway copy before and after, `git diff --name-only`, code and docs counted apart | section "Before and after, and go or no-go" |
| SF1 | Phase 2b: the credential file is created with `mode: 0o600`, `chmod` kept for an existing file; C6 (red first, `chmod` stubbed) and C7 (an existing world-readable file ends owner-only) pin it; temp file plus rename stays deferred | `auth-storage.ts:38-55` writes then restricts |
| SF2 | Open question added, outside the pilot: `.aidd/auth.json` is not in the `.gitignore` lines the CLI writes | `src/contexts/framework/domain/manifest-gitignore-entries.ts:9-14` returns `.aidd/cache/` and machine-local files only |
| SF3 | The "never logs the token" case stays its own test, a negative assertion over every logger call; its break adds a debug call logging the token (Appendix A #41) | `auth-reader.integration.test.ts:264-278` |
| SF4 | #1 to #4, #42, #43 are "deleted with their code", each with the test that now holds the behaviour; N17 added: `log-in` › when the named provider refuses › throws and saves nothing | `auth-provider-adapter.ts:22-26` (verify, then save) |
| SF5 | `removalHint`, `providerOf` and `storedTokenOf` move into `credential-record.ts` as domain functions; the reference marks the domain template provisional until `installation`/`Manifest`; "an aggregate with behaviour" added to what the pilot cannot prove | `auth-provider-adapter.ts:59-61,71-73` |
| SF6 | `domain/` keeps only the source order and the two stop rules (`credential-sources.ts`); the memoized, logging `TokenProvider` is `application/cached-token-provider.ts`; the clock is injected into the file adapter, and the synthesized record's `createdAt` disappears | `auth-reader-adapter.ts:16,27-30,34-61` (memo, logs), `auth-storage.ts:70,83` (`new Date()`) |
| SF7 | Superseded by foundations: `orchestrator-deps` now caps at 5 (`MAX_CONSTRUCTOR_DEPENDENCIES`), so reference section 3 states one cap, 5, held by that test | `orchestrator-deps.arch.test.ts:9`; `target/00-overview.md:102`, `:243` |
| SF8 | R1b counts any importer outside the context; presentation takes `AuthLevel` and `Credential` from `contract/credential.ts`; D7 rewritten | `presentation/display/auth-display.ts:1-2`, `presentation/commands/auth.ts:4` |
| SF9 | `src/contexts/auth/glossary.md` added; reference section 4 requires a glossary | `target/00-overview.md:110`, `target/08-guardrails-and-repo-map.md:202` |
| SF10 | "An unreadable record reads as null" leaves the repository contract: the domain parse table holds the shapes, the adapter integration holds "the read goes through the parse"; the fake keeps records, not text. Chosen over a seeding hook because the port has no operation that writes an unreadable record, so a hook would be a test-only method whose only use is to imitate the disk | `describeFileContract`'s subject seeds through the real port (`file-port-contract.ts:8-16`), which this port cannot do |
| SF11 | C4d added (a user-only record that logout removes; break: wire `() => homedir()`); C4c is `it.skipIf(process.platform === "win32")`, since `sandboxedEnv` sets `PATH` and Windows reads `Path` | `tests/e2e/helpers.ts:244,254` |
| SF12 | Phase 10 corrects `target/00-overview.md` section 12: "only through the `gh` CLI" and "Only 6 files outside it import it" (10) | `shared/infrastructure/github-adapter.ts:8`; the importer listing of the baseline |
| SF13 | Reference: a migrated context's mutation scope is not gated per PR unless it is `telemetry` or `shared` (the target); today every scope a change touches is gated | `target/07-test-architecture.md:356`; `cli/aidd_docs/memory/coding-assertions.md` "In CI only" |
| S1 | `TokenResolver` becomes `ExternalTokenSource`, method `read()`: `TokenProvider.resolve`, `TokenResolver.resolve` and the resolver class were three `resolve` names | `ports/oauth-provider.ts:1-3`, `ports/token-provider.ts:1-3` |
| S2 | R1 has one mechanism: Biome forbids the interior folders to every importer it can see (contexts, `presentation/`, `runtime/` outside the wiring); the arch test keeps only what Biome cannot do, counting importers (R1b) and holding the Biome groups to the data | `target/08-guardrails-and-repo-map.md:44-48` |
| S3 | Folder counts fixed (`ports/` holds 5); phase 1 expects the plan file itself untracked; phase 3 compares counts over the same file set as phase 2 | `git status --short` at planning time: `?? .../plan-pilot-auth.md` |

## Changes after foundations

Branch `refactor/auth-pilot` now sits on `refactor/foundations` (`git log`: `f419b2fa4`, `594b579da`, `d169d3b56`, `0604799cb`). Every row of `plan-foundations.md` "What the pilot plan must change afterwards" is applied, and every file:line this plan cites was re-read on the new base.

| Foundations row | Change here | Evidence on the new base |
| --- | --- | --- |
| Exceptions E3, E4, E7 removed; E9 second reason | E3, E4, E7 deleted from the list; E9 gains the frozen-surface reason | `src/shared/ports/environment.ts`, `src/shared/infrastructure/environment-adapter.ts`, `src/shared/infrastructure/github-adapter.ts`; `tests/architecture/orchestrator-deps.arch.test.ts:9` (`MAX_CONSTRUCTOR_DEPENDENCIES = 5`) |
| M1 to M4 pre-registered | M1 counted as an exception; M2 closed by the pilot; M3 and M4 recorded as migration state by the person's decision; verdict 7 against 7, go at the limit | `github-raw-fetcher-adapter.ts:12` sole context importer of `HttpGet` |
| R3, D9, E7, SF7, reference section 3 | R3 and D9 deleted; the reference states one cap, 5, held by `orchestrator-deps` on every `application/` | `orchestrator-deps.arch.test.ts:9,116-118` |
| D2, D3, phase 3, rows of `gh-token-adapter.ts` and `ports/environment.ts`, trees | phase 3 keeps the `AuthStorage` seam and adds `apiBase` to `GitHubAdapter`; auth declares no `ports/environment.ts` (14 source files, `ports/` 4); `tests/shared/infrastructure/github-adapter.unit.test.ts` replaces `tests/runtime/github/` | `github-adapter.ts:5` takes `http` only and `:8` hardcodes the URL; `tests/shared/infrastructure/github-adapter.unit.test.ts:28` |
| `wireAuth` | lands in `src/composition/auth.ts` (6.4) with rule R7: `KNOWN_SOURCE_AREAS` gains `composition`, `contextOf`, `BELOW_NOTHING`, `isCompositionRoot`, `areaOf`, the Biome groups and parity, coverage and mutation exclusions, `0-deps-wiring.md` rewritten and `0-contexts.md`'s line (D20) | `old-layout-count.arch.test.ts` `KNOWN_SOURCE_AREAS`; `helpers.ts:149-160`; `context-boundary.arch.test.ts:173-175`; `earned-sharing.arch.test.ts:15` |
| `0-hexagonal.md:26` | rewritten in phase 4 to name the two port layouts (E8) | `0-hexagonal.md:26` reads "One context: `domain/ports/`. Two: `shared/ports/`." |
| R4 | purity paths also on `src/shared/ports/**` | `biome.json` override 1 (`src/shared/ports/**/*.ts`) |
| R2 weights | `distribution->runtime` 5 in 3 to 3 in 2; `framework->runtime` 8 in 7 to 6 in 6 | `helpers.ts:139,146` |
| Phase 4 counter | `COMMITTED_COUNTS["src/runtime/"]` 37 to 25 | `old-layout-count.arch.test.ts` `COMMITTED_COUNTS`; `find src/runtime/auth -name '*.ts' \| wc -l` = 12 |
| Mutation baseline | `runtime` without auth computes to 89.16 (625 of 701): 6 kills, measured in phase 1, made in phase 3; `auth` without the token check computes to 95.76 | `plan-foundations.md` "Measured baseline" |
| Test counts | the auth set is 121 tests in 12 files, 1,786 lines in 14 files (one sandboxed run on the new base); the 17 token-check tests are outside it | `sbx npx vitest run tests/runtime/auth ...`: 121 passed |

Citations that moved and were corrected: `framework.ts:102-107` to `:104-107` (auth imports), `distribution.ts:21` to `:22`, `helpers.ts:159` to `:160`, `:174` to `:175`, `:177-193` and `:187-188` to `:185-199` and `isCrossing` `:178-182`, `orchestrator-deps.arch.test.ts:94-96` to `:116-118`, `vitest.mutation.config.ts:9-33` to `:16-35`, `biome-guards-bite.arch.test.ts:62-76` to `:63-80`, `gh-token-adapter.ts:2,8` and `gh-token-adapter.unit.test.ts:32` to `shared/infrastructure/github-adapter.ts:5,8` and `tests/shared/infrastructure/github-adapter.unit.test.ts:28`. Re-read and unchanged: every line of `src/runtime/auth/**`, `framework.ts:144-145,218,220-233,614-615`, `context-boundary.arch.test.ts:173-175,218-226`, `biome-context-parity.arch.test.ts:1-4,16-17`, `ports-are-called.arch.test.ts:14`, `earned-sharing.arch.test.ts:15,17-20`, `tests/e2e/helpers.ts:244,254`, `native-plugin-cli-adapter.codex.integration.test.ts:11`, `private-storage-adapter.ts:4`, `scripts/smoke-tools.sh:158,192-201`, `scripts/sweep-stale-test-dirs.cjs:13`, `manifest-gitignore-entries.ts:9-14`. Citations of `target/*` documents are to unchanged files.

What no longer holds: the "seams" half for `gh-token-adapter.ts` (done by foundations); `runtime/github/` (never created); an auth `Environment` port; R3 and its plugin copy; the 4-versus-5 cap split; `runtime/wiring/auth.ts`; 138 tests, 13 files and 1,872 lines as the auth set; 90.07 as the `runtime` margin; 9 against 7 as the verdict.

## Measured baseline

Measured on this branch, in a sandbox, before any change. Phase 1 re-runs each line and stores it in `$B`; a different figure there replaces this one.

| Measure | Value | Command |
| --- | --- | --- |
| Source files and lines, `src/runtime/auth/**` | 12 files, 421 lines (largest `auth-storage.ts` 115, `auth-reader-adapter.ts` 82, `auth-provider-adapter.ts` 74); `gh-token-adapter.ts` left for `shared/infrastructure/github-adapter.ts` with foundations | `find src/runtime/auth -type f \| xargs wc -l` |
| Presentation of auth | `commands/auth.ts` 111, `display/auth-display.ts` 28 | `wc -l` |
| Auth in the composition root | `runtime/wiring/framework.ts:104-107` (4 auth imports; `GitHubAdapter` `:100`, `EnvironmentAdapter` `:99`, `Environment` `:102` come from `shared/`), `:144-145` (2 `Deps` fields), `:220-233` (construction), `:244` (`new EnvironmentAdapter()`), `:614-615`; `runtime/wiring/distribution.ts:22,29` | reading |
| Importers of `runtime/auth` in `src`, outside it | 10 files, not the 6 the overview counts: distribution 2 (`github-raw-fetcher-adapter.ts:11`, `plugin-fetcher-adapter.ts:15`), framework 2 (`doctor-layout-use-case.ts:2`, `setup-marketplace-registration-use-case.ts:6`), presentation 2, self-update 2 (`self-updater-adapter.ts:10`, `github-release-resolver-adapter.ts:7`), wiring 2 | `grep -rln "runtime/auth" src; grep -rln "from \"\.\./auth/" src/runtime` |
| Test files and lines | 10 files under `tests/runtime/auth`, 1,380 lines; `auth-wiring.integration.test.ts` 290; `auth-display.unit.test.ts` 74; helpers `tests/helpers/auth.ts` 32 and `tests/helpers/ports/fake-auth-reader.ts` 10. Total 1,786 lines in 14 files. `gh-token-adapter.unit.test.ts` (17 tests) left for `tests/shared/infrastructure/github-adapter.unit.test.ts` with foundations | `wc -l` |
| Tests and their time | 121 tests in 12 files (138 before foundations, not the 175 the overview counts); 229 ms vitest duration, one run on the new base (162 ms for 13 files before it); phase 1 re-measures three runs | `sbx npx vitest run tests/runtime/auth tests/presentation/commands/auth-wiring.integration.test.ts tests/presentation/display/auth-display.unit.test.ts --reporter=json --outputFile="$B/tests.json"` |
| Assertions | 138 of 138 tests asserted something before foundations; phase 1 re-measures the 121 | same run with `--expect.requireAssertions` |
| Coverage of auth by its tests | 100 % lines and functions, 99.26 % branches; the one branch missed is `auth-storage.ts:50` | coverage run, phase 1 |
| Mutation of `src/runtime/auth/**` alone | before foundations: 322 mutants, 310 killed, 12 survived, 96.27, 10 s wall, of which `gh-token-adapter.ts` 39 of 39; without it, computed: 271 of 283, 95.76. Survivors: `auth-reader-adapter.ts:13` (the default `noopExternalProvider`), `auth-storage.ts:28` and `:39` (`"utf-8"`), `:45-46` (the `stdio` option of `icacls`), `:107` (4, the object guard of `isAuthConfig`) | stryker with `mutate: ["src/runtime/auth/**/*.ts"]`, re-run in phase 1 |
| Mutation of the rest of `runtime` | before foundations, measured: 89.58 (705 of 787) without auth. On the new base, computed by `plan-foundations.md` ("Measured baseline"): 625 of 701, 89.16, once `http-client.ts` and `gh-token-adapter.ts` left for `shared`: under the floor of 90, 6 more kills needed (631 of 701). Phase 1 measures it | temp stryker config, `mutate: ["src/runtime/**/*.ts", "!src/runtime/auth/**/*.ts"]` |
| Constructor widths | `AuthReaderAdapter` 5 (`auth-reader-adapter.ts:18-25`), `AuthProviderAdapter` 4 (`auth-provider-adapter.ts:14-19`), the three use cases 1 each, `AuthStorage` and `GhCliAdapter` 0; `GitHubAdapter` 1, now in `shared/` | reading |
| Code-size rules on the current tree | `presentation/commands/auth.ts`: function length and cognitive complexity over the limits (the `login` action, `:23-78`); `runtime/auth/**`: none | `size_check src/runtime/auth/*.ts src/runtime/auth/ports/*.ts src/presentation/commands/auth.ts` |
| Cost of a new credential source | listed: 6 files (2 code, 2 test, 2 docs), below; measured in phase 1 | throwaway copy, phase 1 |
| Pre-filter: unique coverage per test file | measured before foundations, `gh-token-adapter.unit` then included and now outside the set: none for `auth-login-use-case.unit` (4 tests), `auth-status-use-case.unit` (2), `auth-storage-shape.integration` (13); the largest unique share is `auth-wiring.integration` (70 statements and branches of `commands/auth.ts`) | leave-one-out coverage, phase 1 |
| Pre-filter: duplication | 4 exact clones, each within one file: `auth-logout-use-case.integration` `:43-50`/`:59-66`; `auth-reader.integration` `:111-123`/`:202-214` and `:131-141`/`:222-233`; `auth-storage-shape.integration` `:52-60`/`:72-80` | `npx jscpd ... --min-lines 5` |
| Pre-filter: duplicate titles | `returns external token when method=external` (twice in `auth-reader.integration`), `returns null when no token source is available` (`auth-reader.integration:165`, `auth-storage.integration:245`) | `grep` of titles, `uniq -d` |

### The credential source

Definition, the same before and after: a new environment variable `GH_TOKEN`, consulted after `AIDD_TOKEN` and before the project record, honoured by `aidd auth status` and by token resolution, with one test per changed behaviour and every document that states the order updated.

Listed from reading, today:

| File | Why |
| --- | --- |
| `src/runtime/auth/auth-reader-adapter.ts` | `resolveUncached` holds the token order (`:32-50`) |
| `src/runtime/auth/auth-storage.ts` | `readActive` holds the status order a second time (`:62-76`) |
| `tests/runtime/auth/auth-reader.integration.test.ts` | the order of `resolve` |
| `tests/runtime/auth/auth-storage.integration.test.ts` | the order of `readActive` |
| `cli/aidd_docs/memory/auth.md` | states the order (`:9`, `:20`) |
| `cli/.claude/rules/07-quality/7-auth.md` | states the order again (`:11-13`) |

Measured in phase 1 (before) and phase 11 (after), the listing above being only the prediction:

```sh
M="$(mktemp -d "${TMPDIR:-/tmp}/aidd-auth-source-XXXX")"
rsync -a --exclude node_modules --exclude dist --exclude reports cli/ "$M/cli/"
ln -s "$PWD/cli/node_modules" "$M/cli/node_modules"
git -C "$M" init -q && git -C "$M" add -A && git -C "$M" -c user.name=m -c user.email=m@m commit -qm base
# implement the GH_TOKEN source in $M/cli by the definition above, then:
(cd "$M/cli" && sbx npx vitest run tests/runtime/auth tests/contexts/auth)   # must be green
git -C "$M" diff --name-only | tee "$B/source-<before|after>.txt"
grep -v '\.md$' "$B/source-<before|after>.txt" | wc -l   # code and test files
grep '\.md$' "$B/source-<before|after>.txt" | wc -l     # documents
rm -rf "$M"
```

A copy with its own repository, because the pilot's tree is never committed and a worktree of `HEAD` would not hold it; nothing touches this repository.

## Target, file by file

### Source

Path under `cli/src/`. Phase is the phase that gives the file its final form; earlier phases may move it under its current name.

| Current | Target | Action | Becomes | Phase |
| --- | --- | --- | --- | --- |
| `runtime/auth/auth.ts` | `contexts/auth/contract/credential.ts` and `contexts/auth/domain/credential-record.ts` | move, rename, split | `contract/credential.ts`: `AuthLevel`, `AuthMethod`, `Credential` (ex `AuthCredential`, a stored token or an external provider), the types presentation and the domain both use. `domain/credential-record.ts`: aggregate `CredentialRecord` (ex `AuthConfig`, the `auth.json` document of one level) with its invariants and behaviour: `parseCredentialRecord(value)` (ex `isAuthConfig`, `auth-storage.ts:106-115`), `recordCredential(credential, level, createdAt)` (ex `auth-storage.ts:79-87`), `removalHint(record)` (ex `auth-provider-adapter.ts:71-73`), `providerOf(record)` (ex `:59`, `DEFAULT_PROVIDER = "gh"`), `storedTokenOf(record)` (ex `:61`, throws `invalid config`); and `LEVELS_BY_PRECEDENCE = ["project", "user"]`, the one place the level order is written | 4, 5, 6 |
| `runtime/auth/auth-reader-adapter.ts` | `contexts/auth/domain/credential-sources.ts` and `contexts/auth/application/cached-token-provider.ts` | move, rename, split | domain: `sourcesInOrder(supplied, readRecord)` (command line, `AIDD_TOKEN`, then `LEVELS_BY_PRECEDENCE`, records read lazily as today), `tokenFrom(source, readExternal)` (the token stop rule, `:52-66`), `holdsRecord(source)` (the status stop rule, `auth-storage.ts:73-75`), the value object `SuppliedTokens` (`commandLine?`, `environment`, the `shared/ports/environment.ts` port) and `ActiveCredential` (level and credential, no `createdAt`). Application: `CachedTokenProvider implements TokenProvider`, memoized (`:16,27-30`) and logging (`:34-61`, exact messages); constructor: repository, supplied tokens, external token source, logger (4). `resolveContext` deleted (no caller: `grep -rn resolveContext src` finds only `:68`). The default `noopExternalProvider` (`:13`, a surviving mutant) deleted: the composition always passes the `gh` adapter (`runtime/wiring/framework.ts:222-228`) | 4, 5, 6 |
| `runtime/auth/auth-provider-adapter.ts` | none | move to `infrastructure/` unchanged, then delete in 6.5 | its three methods become the three commands, its three rules the aggregate's (SF5); doc 05's `credential-session.ts` is not created, see D5 | 4, 6 |
| `runtime/auth/auth-login-use-case.ts` | `contexts/auth/application/log-in.ts` | move, rename, rewrite | command `LogIn`, `execute(command: LogInCommand): Promise<LogInResult>`: verifies (identity verifier for a stored token, the named CLI provider for an external one), then saves; private `loginOf(credential)`. Constructor: repository, identity verifier, CLI providers (3) | 4, 5, 6 |
| `runtime/auth/auth-logout-use-case.ts` | `contexts/auth/application/log-out.ts` | move, rename, rewrite | command `LogOut`, `execute(): Promise<LogOutResult>`: deletes the first record in `LEVELS_BY_PRECEDENCE`, reports the level the record names (`auth-provider-adapter.ts:44,52`) and `removalHint(record)`. Constructor: repository (1) | 4, 5, 6 |
| `runtime/auth/auth-status-use-case.ts` | `contexts/auth/application/check-status.ts` | move, rename, rewrite | command `CheckStatus`, `execute(): Promise<CheckStatusResult>`: walks `sourcesInOrder` without the command line to the first `holdsRecord`, verifies it (`providerOf`, `storedTokenOf`). Constructor: repository, environment (`shared/ports/environment.ts`), identity verifier, CLI providers (4) | 4, 5, 6 |
| `runtime/auth/auth-storage.ts` | `contexts/auth/infrastructure/credential-record-file-adapter.ts` | seam in place (phase 3), owner-only creation (2b), move, rename, level-keyed (6.3), old methods removed (6.6) | `CredentialRecordFileAdapter implements CredentialRecordRepository`: `read(level)`, `save(credential, level)` (stamps `createdAt` from the injected clock), `delete(level)`; paths, JSON, `writeFile(..., { mode: 0o600 })`, `chmod`, `icacls`, `windowsAccount` stay here. Constructor: project root, user config directory as a function (the shape of `UserManifestRepositoryAdapter`, `framework.ts:218`), clock `() => Date` (3) | 2b, 3, 4, 6 |
| `runtime/auth/gh-cli-adapter.ts` | `contexts/auth/infrastructure/gh-cli-adapter.ts` | move; method `resolve` renamed `read` (S1) | `GhCliAdapter implements CliAuthProvider` | 4, 5 |
| `shared/infrastructure/github-adapter.ts` (moved and renamed by foundations, no longer implementing `TokenAuthProvider`) | same | modify | `GitHubAdapter`, `verifyToken(token)`: phase 3 adds `apiBase` to the constructor, `(http, apiBase = "https://api.github.com")`, URL `${this.apiBase}/user` (`github-adapter.ts:5,8`), for the phase 8 contract suite's local server; it imports nothing from auth and satisfies `IdentityVerifier` by shape (D2) | 3 |
| `runtime/auth/ports/credential-file-store.ts` | none; replaced by `contexts/auth/ports/credential-record-repository.ts` | move unchanged, kept beside the new port during 6.3 to 6.5, delete in 6.6 | port `CredentialRecordRepository` (repository of the aggregate, level-keyed): `read(level)`, `save(credential, level)`, `delete(level)` | 4, 6 |
| `runtime/auth/ports/oauth-provider.ts` | `contexts/auth/ports/external-token-source.ts`, `cli-auth-provider.ts`, `identity-verifier.ts` | move, split, rename | `ExternalTokenSource` (ex `TokenResolver`, `read(): string \| null`), `CliAuthProvider extends ExternalTokenSource` (`verify(): Promise<string>`, the `gh api user` check), `IdentityVerifier` (ex `TokenAuthProvider`, `verifyToken(token): Promise<string>`, the `/user` check). One interface per file (`.claude/rules/01-standards/1-conventions.md`) | 4, 5 |
| `runtime/auth/ports/credential-store.ts` | none | move unchanged, delete in 6.5 | the port of the three pass-through use cases; its result types become `LogInResult`, `LogOutResult`, `CheckStatusResult` in the command files | 4, 6 |
| `runtime/auth/ports/token-provider.ts` | `contexts/auth/contract/token-provider.ts` | move | contract `TokenProvider`, imported by distribution (2), framework (2), self-update (2) | 4 |
| (new) | `contexts/auth/glossary.md` | add | the context's language in English: credential, record, level, method, provider, command-line token, `AIDD_TOKEN`, active credential, removal hint, identity check (SF9) | 6 |
| `presentation/commands/auth.ts` | same | modify | receives `deps.logIn`, `deps.logOut`, `deps.checkStatus` (no `new`, `:70,89,105`); imports `contract/credential.ts` and `application/` only; the `login` action split under the code-size limits | 6, 7 |
| `presentation/display/auth-display.ts` | same | modify | imports `AuthLevel` from `contract/credential.ts` and the results from `application/` | 6 |
| `runtime/wiring/framework.ts` | same | modify | builds auth through `wireAuth`; `Deps.authReader` deleted (no reader: `grep -rn "\.authReader" src` finds none outside wiring), `Deps.credentialStore` replaced by the three commands; the `tokenProvider` of `wireAuth` reaches doctor, self-update, the release resolver and `wireDistribution` | 3, 6 |
| `runtime/wiring/distribution.ts` | same | modify | `authReader: AuthReaderAdapter` (`:21,29`) becomes `tokenProvider: TokenProvider` | 4, 6 |
| (new) | `composition/auth.ts` | add | `wireAuth({ projectRoot, logger, http, environment, explicitToken })`: one parameter object, returns the `TokenProvider` and the three commands; called by `runtime/wiring/framework.ts`, which composes everything until the root moves (`target/code-map/src-runtime-kernel-presentation-distribution.md:15`). Creating `src/composition/` brings the guards of R7 in the same step (6.4) | 6 |
| `runtime/self-update/self-updater-adapter.ts`, `github-release-resolver-adapter.ts`; `contexts/distribution/infrastructure/github-raw-fetcher-adapter.ts`, `plugin-fetcher-adapter.ts`; `contexts/framework/application/doctor/doctor-layout-use-case.ts`, `shared/setup-marketplace-registration-use-case.ts` | same | modify | import `TokenProvider` from `contexts/auth/contract/` | 4 |

Final tree of the context, 14 source files and the glossary, at most 4 per folder; auth takes `Environment` from `shared/ports/environment.ts` and declares no port of its own for it:

```txt
cli/src/contexts/auth/
├── glossary.md
├── contract/credential.ts
├── contract/token-provider.ts
├── domain/credential-record.ts
├── domain/credential-sources.ts
├── ports/cli-auth-provider.ts
├── ports/credential-record-repository.ts
├── ports/external-token-source.ts
├── ports/identity-verifier.ts
├── application/cached-token-provider.ts
├── application/check-status.ts
├── application/log-in.ts
├── application/log-out.ts
├── infrastructure/credential-record-file-adapter.ts
└── infrastructure/gh-cli-adapter.ts
cli/src/shared/infrastructure/github-adapter.ts   modified: apiBase
cli/src/composition/auth.ts
```

Who imports what at the end, checked by phase 9:

| Importer | May import from auth |
| --- | --- |
| `contexts/distribution`, `contexts/framework` | `contract/` only |
| `presentation/` | `contract/` and `application/` |
| `runtime/self-update` | `contract/` |
| `runtime/wiring/`, `composition/` | anything (composition root; `isCompositionRoot` accepts both from 6.4, `context-boundary.arch.test.ts:173-175`) |
| `contexts/auth/**` | `shared/ports/` (`Environment`), `kernel/` (errors, `Logger`, `AIDD_DIR`: migration state M3), its own folders in the layer direction, nothing else |

### Tests

Path under `cli/tests/`. Verdicts are planned; Appendix A holds one row per test.

| Current | Tests | Verdict | Target | Phase |
| --- | --- | --- | --- | --- |
| `runtime/auth/auth-login-use-case.unit.test.ts` | 4 | delete with its code: the use case is a pass-through (`auth-login-use-case.ts:12-14`); the behaviour is held by `log-in.unit` (#9 to #12, C1, N17) | `contexts/auth/application/log-in.unit.test.ts` | 6 |
| `runtime/auth/auth-status-use-case.unit.test.ts` | 2 | delete with its code (`auth-status-use-case.ts:6-8`); held by `check-status.unit` (#13, #14) | `check-status.unit.test.ts` | 6 |
| `runtime/auth/auth-provider-adapter.unit.test.ts` | 9 | rewrite, split by command | `application/log-in.unit.test.ts` (4), `application/check-status.unit.test.ts` (5) | 6 |
| `runtime/auth/auth-logout-use-case.integration.test.ts` | 4 | rewrite one level down | `application/log-out.unit.test.ts` | 6 |
| `runtime/auth/auth-reader.integration.test.ts` | 14 | rewrite one level down; the 4 `resolveContext` cases deleted with the method; the order becomes one table | `application/cached-token-provider.unit.test.ts`, `domain/credential-sources.unit.test.ts` | 6 |
| `runtime/auth/auth-reader-branches.unit.test.ts` | 10 | rewrite; the "no provider wired" case deleted with its default | same two files | 6 |
| `runtime/auth/auth-storage-shape.integration.test.ts` | 13 | split: the 8 unreadable shapes to the parse table; the two record shapes to the repository contract; the bytes (with C5) to the adapter integration; the `AIDD_TOKEN` synthesis to `credential-sources`; the empty Windows account to the adapter integration | `domain/credential-record.unit.test.ts`, `ports/credential-record-repository.contract.test.ts`, `infrastructure/credential-record-file-adapter.integration.test.ts`, `domain/credential-sources.unit.test.ts` | 6, 8 |
| `runtime/auth/auth-storage.integration.test.ts` | 22 | split: absent, round trip, save per level, delete to the repository contract; unreadable records, parents, paths, `0600` and the four win32 cases to the adapter integration; the `readActive` cases to `credential-sources`; delete `written file can be read back`, `saves external credential without token field` and the `readActive` case for `AIDD_TOKEN` by inverted proof; `userConfigPath respects AIDD_USER_CONFIG_DIR` rewritten in phase 3 to the injected directory and kept (the override itself is `userConfigDirOf`'s, `tests/runtime/user-config-dir.unit.test.ts:33`) | contract, adapter integration, `credential-sources` | 3, 6, 8 |
| `runtime/auth/gh-cli-adapter.integration.test.ts` | 6 | merge with the next file into one adapter test, `spawnSync` still mocked (`:5-7`): `gh`'s answers translated (stderr wording, upgrade hint, exit code) are adapter detail, proven at the lowest level that runs on every platform | `contexts/auth/infrastructure/gh-cli-adapter.integration.test.ts` | 8 |
| `runtime/auth/gh-cli-verify.integration.test.ts` | 9 | same file; delete `throws with stderr when gh auth token exits non-zero` (`gh-cli-adapter.integration.test.ts:43`) by inverted proof against `trims the stderr it reports` | same | 8 |
| `tests/shared/infrastructure/github-adapter.unit.test.ts` (moved by foundations) | 17 | keep, outside the auth test set; phase 3 adds the `apiBase` case; kept by the relevance rule: the default base URL (`:28`), the 8 bodies and 6 statuses are the adapter's translation, which the contract does not hold (D15) | same | 3 |
| `presentation/commands/auth-wiring.integration.test.ts` | 22 | keep; the mocked `createDeps` returns `logIn`, `logOut`, `checkStatus` instead of `credentialStore` (`:12-18`); titles drop the em dash | same | 6 |
| `presentation/display/auth-display.unit.test.ts` | 6 | keep; imports follow | same | 6 |
| `helpers/auth.ts` | 0 | phase 3: the `Object.create` override (`:13-15`) becomes a constructor argument; phase 6: `makeAuthConfig` becomes the kit's record builders and the file goes | `contexts/auth/testing/credential-records.ts` | 3, 6 |
| `helpers/ports/fake-auth-reader.ts` | 0 | delete with its export (`helpers/ports/index.ts:4`): its only importer is a framework test (`doctor-layout-use-case.unit.test.ts:8`), and a context's kit is never imported by another context (doc 07 section 2.1); the three other consumers already double `TokenProvider` inline (`setup-marketplace-registration-use-case.unit.test.ts:98`, `plugin-fetcher-cache-and-auth.unit.test.ts:65-66`, `setup-auth-guard.unit.test.ts:84-86`) | inline `{ resolve: async () => token }` | 6 |
| (new) | characterization | add before anything moves | 8 tests: C1, C2, C3, C4b, C4c, C4d, C5 (phase 2), C6, C7 (phase 2b) | 2, 2b |
| (new) | the three contract suites, port semantics only, on fake and real | add | `contexts/auth/ports/*.contract.test.ts` | 8 |

The auth kit, `tests/contexts/auth/testing/` (8 files, each one subject):

| File | Exports |
| --- | --- |
| `credential-records.ts` | `aStoredRecord(overrides)`, `anExternalRecord(overrides)` |
| `in-memory-credential-record-repository.ts` | `InMemoryCredentialRecordRepository`: keeps one `CredentialRecord` per level (SF10: the unreadable-file case belongs to the adapter) |
| `fake-identity-verifier.ts` | `FakeIdentityVerifier`: a login per known token, `AuthenticationError("GitHub API")` otherwise, records the tokens it saw without ever printing one |
| `fake-cli-auth-provider.ts` | `FakeCliAuthProvider`: a scripted token, login or failure |
| `auth-builders.ts` | `aCachedTokenProvider()`, `aLogIn()`, `aLogOut()`, `aCheckStatus()`: a neutral double for every dependency, `with*` for what a test overrides, `build()` |
| `credential-record-repository-contract.ts` | `describeCredentialRecordRepositoryContract(subjectName, makeSubject, knownDivergences?)` |
| `identity-verifier-contract.ts` | `describeIdentityVerifierContract(...)` |
| `cli-auth-provider-contract.ts` | `describeCliAuthProviderContract(...)` |

Names follow the landed convention, `describe<Port>Contract` (`tests/helpers/ports/file-port-contract.ts`, `cli/aidd_docs/memory/testing.md` "Contract"), not doc 07's `run<X>Contract` (A7). Contract test files mirror the port they hold, under `tests/contexts/auth/ports/` (A8).

Final test tree:

```txt
cli/tests/contexts/auth/
├── testing/                      the kit, 8 files
├── domain/credential-record.unit.test.ts
├── domain/credential-sources.unit.test.ts
├── application/cached-token-provider.unit.test.ts
├── application/check-status.unit.test.ts
├── application/log-in.unit.test.ts
├── application/log-out.unit.test.ts
├── ports/cli-auth-provider.contract.test.ts
├── ports/credential-record-repository.contract.test.ts
├── ports/identity-verifier.contract.test.ts
├── infrastructure/credential-record-file-adapter.integration.test.ts
├── infrastructure/credential-record-file-adapter-create-mode.integration.test.ts   C6, chmod stubbed
└── infrastructure/gh-cli-adapter.integration.test.ts
cli/tests/presentation/commands/auth.integration.test.ts          characterization through the real wiring
cli/tests/presentation/commands/auth-wiring.integration.test.ts
cli/tests/presentation/display/auth-display.unit.test.ts
cli/tests/shared/infrastructure/github-adapter.unit.test.ts         the /user translation of GitHubAdapter, outside the auth set
```

## The test challenge pass

Applied in phases 6 and 8 to every test, recorded in Appendix A, made mandatory for every later context by phase 10.

1. Deterministic pre-filter (phase 1; candidates, never verdicts):
   - unique coverage per file: coverage of the auth sources with all auth test files, then once without each file; three candidates today. Coverage does not see exact-value assertions, so a candidate still needs step 2.
   - `jscpd` on the auth tests (4 clones, each within one file: they become builder calls or table rows).
   - `--expect.requireAssertions` (138 of 138 before foundations; the 121 of the auth set re-measured in phase 1).
   - duplicate titles (2).
2. Inverted proof for every deletion that is not a deletion of the code it tested: break the behaviour by hand, another named test goes red, restore; the break and the red test are written in the row. A test deleted with its code names the test that now holds the behaviour and is proven the same way against the new code. Optional evidence: the auth-only stryker run takes about 10 s, so a candidate can be checked by the score with and without it, a leave-one-out measure, not the `killedBy` attribution the overview rejects (`target/00-overview.md` section 10).
3. Rewrite to target: the lowest level that proves it (doc 07 section 1); the kit; contract suites holding the port's promise on fake and real; adapter translation in the adapter's test; titles in English, `describe` a situation, `it` an observable result; one subject per file; 400 lines a review point, 800 a failure (`test-file-size.arch.test.ts`).
4. A rewritten or new test is run once against a deliberately broken subject and goes red for the reason it names (`aidd_docs/memory/coding-assertions.md`, "Before the code").

Appendix A shape:

| # | Current file › title | Behaviour it pins | Pre-filter flags | Verdict | Target file › title | Proof (break applied => test that went red) |
| --- | --- | --- | --- | --- | --- | --- |

Counts closing the table: tests and lines before and after; kept, rewritten, merged, moved to the kit, deleted with their code, deleted by proof, added.

## Rules in force for this context

Each rule enters with a planted tree that violates it and proves it bites (`target/08-guardrails-and-repo-map.md` section 2.3). Phase 4 makes the edges true; phase 9 adds the rest.

| Rule | Mechanism | Planted tree | What changes |
| --- | --- | --- | --- |
| R1. Public surface by path: auth's `domain/`, `ports/` and `infrastructure/` are imported by nothing outside the context but the composition root; replaces `PUBLIC_MODULES` for auth | one mechanism, Biome (S2): the groups `**/auth/domain/**`, `**/auth/ports/**`, `**/auth/infrastructure/**` in every `noRestrictedImports` override of an importer that may reach auth (the six `distribution` and `framework` overrides), plus the two overrides foundations created, `src/presentation/**/*.ts` and `src/runtime/**/*.ts` with `!src/runtime/wiring/**` (`biome.json` overrides 3 and 4, today forbidding `**/shared/infrastructure/**` only; their expected lists in `biome-context-parity.arch.test.ts:171-178` gain the groups). The arch test does only what Biome cannot: `context-boundary.arch.test.ts` lists auth in `HELD_BY_BIOME` (skipped by the list check, counted as declared by `:218-226`), and `biome-context-parity.arch.test.ts` computes the expected groups for every importer of a `HELD_BY_BIOME` context from `ALLOWED`, so the groups are data, not a hand list | Biome: a planted `src/presentation/display/x.ts` importing `../../contexts/auth/domain/credential-record.js` is reported, one importing `.../contract/credential.js` or `.../application/log-in.js` is not; same for a planted `src/contexts/distribution/infrastructure/x.ts` and a planted `src/runtime/self-update/x.ts`; a planted `src/runtime/wiring/x.ts` importing the domain is not | `biome.json`, `context-boundary.arch.test.ts`, `biome-context-parity.arch.test.ts` |
| R1b. A `contract/` file is imported by at least one file outside its context (another context, `presentation/`, `orchestration/` or a runtime service; the composition root does not count) | new case in `context-boundary.arch.test.ts`, computed from `importersByFile()` | a planted `contract/orphan.ts` with only an in-context or wiring importer fails; `token-provider.ts` (distribution, framework, self-update) and `credential.ts` (presentation) pass | same file |
| R2. Context-map edges: `distribution -> auth` and `framework -> auth` are the only edges into auth; auth has no outgoing edge | `ALLOWED` in `tests/architecture/helpers.ts:118-123` gains both; `framework -> auth` is the edge of today's host of the doctor and setup scenarios (E1). `update -> auth` cannot exist yet: `self-update` is under `runtime/`, which the graph skips (`isCrossing`, `helpers.ts:178-182`). Biome: `**/auth/**` in the 9 `tools`, `translate`, `telemetry` overrides; auth's five overrides forbid every other context, `presentation` and `runtime` | `context-graph.arch.test.ts` "the guard itself": `tools -> auth` reported, `distribution -> auth` clear; Biome: a planted `src/contexts/tools/domain/x.ts` importing auth reported | `helpers.ts` (`ALLOWED`; `BASELINE` weights lowered, never raised: `distribution->runtime` 5 in 3 (`helpers.ts:139`) becomes 3 in 2 (`github-raw-fetcher-adapter.ts` keeps no `runtime` import once `TokenProvider` leaves), `framework->runtime` 8 in 7 (`:146`) becomes 6 in 6, re-measured by `weighedEdges`), `context-graph.arch.test.ts`, `biome.json`, `biome-context-parity.arch.test.ts` |
| R4. Purity: auth's `domain/`, `ports/` and `contract/`, and `src/shared/ports/` (foundations D13), import no third-party package and no Node builtin but `node:path` and `node:crypto`, and read no `process` | `paths` inside the single `noRestrictedImports` override of each of the three folders (the last matching override wins, `biome-context-parity.arch.test.ts:1-4`): the `dependencies` of `cli/package.json` and `builtinModules` of `node:module` (with and without `node:`) minus `path` and `crypto`, held by a computed assertion in `biome-guards-bite.arch.test.ts` (the denied lists equal those two sources); `noRestrictedGlobals` (override 22, already covering `src/shared/ports/**`) widened to `src/contexts/*/ports/**/*.ts` and `src/contexts/*/contract/**/*.ts` | `domain/x.ts` importing `node:fs`, `node:os`, `commander` reported, `node:path` and `node:crypto` clean; `ports/x.ts` reading `process.env` reported | `biome.json`, `biome-guards-bite.arch.test.ts` (`:63-80`) |
| R5. The two new layers are held like the three old ones | `biome-context-parity.arch.test.ts`: `LAYERS` (`:16-17`) keeps the three mandatory layers and checks `ports` and `contract` wherever the folder exists (E8); `ports` forbids what `domain` forbids; `contract` forbids every other folder of its context; `helpers.ts` `LAYER_OF_FILE` (`:175`) reads the five | a context with a `contract/` folder and no override fails | same files |
| R7. `src/composition/` is a known area and the composition root (foundations deferred it to the phase that creates the folder, 6.4) | `old-layout-count.arch.test.ts` `KNOWN_SOURCE_AREAS` gains `composition`; `contextOf` returns `composition` and `BELOW_NOTHING` holds it (`helpers.ts:149-160`); `isCompositionRoot` accepts `src/composition/` (`context-boundary.arch.test.ts:173-175`); `areaOf` maps it to `composition-root` (`earned-sharing.arch.test.ts:15`); `**/composition/**` in every context, `shared/` and `kernel/` override and in the presentation and non-wiring runtime overrides (only the composition root and `cli.ts` import it, `target/08-guardrails-and-repo-map.md:59`), and in the parity test's expected targets | `context-graph.arch.test.ts`: `tools -> composition` reported, `composition -> tools` clear; Biome: a planted `src/contexts/tools/domain/x.ts` importing `../../../composition/auth.js` reported; the counter: a planted top-level `src/elsewhere/` still fails | `old-layout-count.arch.test.ts`, `helpers.ts`, `context-boundary.arch.test.ts`, `earned-sharing.arch.test.ts`, `biome.json`, `biome-context-parity.arch.test.ts` |
| R6. A port method has a caller, contract included | `ports-are-called.arch.test.ts` `portFiles` (`:14-27`) also reads `contract/` | a `contract/` plant in its "guard itself" | same file |

`BASELINE` entries are lowered by recomputing them in the phase that changes them, never added. Phases 4 to 8 keep auth in `PUBLIC_MODULES` with the modules imported at that point so the tree stays green; phase 9 swaps it for R1.

## Files that name paths

The checklist of `target/00-overview.md` section 11 item 6, applied to auth.

| File | Change | Phase |
| --- | --- | --- |
| `tests/architecture/old-layout-count.arch.test.ts` | `COMMITTED_COUNTS["src/runtime/"]` 37 lowered to 25 (the 12 files of `runtime/auth`) in phase 4; `KNOWN_SOURCE_AREAS` gains `composition` in 6.4 | 4, 6 |
| `cli/mutation-scopes.json` | `excluded` gains `src/composition/**` (6.4) with the reason of `vitest.config.ts:104` (composition is driven by in-process and e2e tests the mutation run leaves out, `vitest.mutation.config.ts:16-35`); new scope `auth`, `"mutate": "src/contexts/auth/**/*.ts"`, floor = the score measured in phase 4; `runtime` stays 90. Neither floor is lowered in the pilot: a run under it is answered by tests that kill named survivors (D11) | 4, 6, 8 |
| `cli/package.json` | `test:mutation:auth` (required by `mutation-covers-source.arch.test.ts`) | 4 |
| `cli/knip.json` | nothing: the kit is not under the ignored `tests/helpers/**`, so an unused kit export is reported | none |
| `cli/vitest.config.ts` | coverage `exclude` (`:113-119`) gains `src/contexts/*/ports/**`, `src/contexts/*/contract/**` (phase 4) and `src/composition/**` (6.4) | 4, 6 |
| `tests/architecture/tool-addition-cost.arch.test.ts` | nothing | none |
| repository script tests naming `cli/` files | none names an auth file | none |
| `scripts/sweep-stale-test-dirs.cjs` | prefix `auth-storage-test-` (`:13`) removed once no test creates it; new temp dirs use `aidd-auth-` | 8 |
| `lefthook.yml` | nothing: globs are `cli/src/**` and `cli/tests/**` | none |
| `cli/aidd_docs/memory/codebase-map.md`, `tests/architecture/codebase-map.arch.test.ts` | `contexts/auth/{application,contract,domain,infrastructure,ports}` added, `runtime/auth` removed (phase 4), `composition/` added (6.4) | 4, 6 |
| `cli/aidd_docs/memory/architecture.md` | mermaid gains `distribution -> auth`, `framework -> auth` | 4 |
| `cli/aidd_docs/memory/auth.md` | paths follow each phase; phase 10 moves it to `cli/aidd_docs/memory/internal/auth.md` (`target/code-map/harness-and-repo.md:80`), updating every file that imports or links it: `cli/CLAUDE.md` (memory list), `cli/aidd_docs/memory/README.md`, `cli/aidd_docs/memory/ecosystem.md`, the rule below | 4, 10 |
| `cli/.claude/rules/07-quality/7-auth.md` | `paths:` (`:4`) follows in phase 4; phase 10 moves it to `cli/.claude/rules/cli-contexts/auth.md` (`target/code-map/harness-and-repo.md:61`): reason to change, ports, suppliers, a pointer to the memory page; the repeated order (`:11-13`) removed | 4, 10 |
| `cli/aidd_docs/memory/testing.md` | "Contract" gains the per-context kit and contract placement | 8 |
| `cli/.claude/rules/00-architecture/0-deps-wiring.md`, `0-contexts.md` | 7d of `target/00-overview.md:164`, deferred by foundations: `0-deps-wiring.md` rewritten (the composition root is `runtime/wiring/`, old layout, and `composition/`, target; a new context's wiring module goes to `composition/<context>.ts`; `runtime/wiring/framework.ts` composes them until the root moves; only the composition root instantiates an adapter; `paths:` gains `src/composition/**/*.ts`) and the `composition/` line of `0-contexts.md`'s chain | 6 |
| `cli/.claude/rules/00-architecture/0-hexagonal.md` | `:26` "One context: `domain/ports/`. Two: `shared/ports/`." rewritten to name the coexistence of `ports/` (migrated contexts) and `domain/ports/` (the others), recorded as E8 | 4 |
| `cli/.claude/skills/**` | none names auth | none |

## `reference-context.md`

Written in phase 10 from the code and tests after phase 9. Location: `cli/.claude/rules/cli-contexts/reference-context.md`, `paths: ["src/contexts/**/*.ts", "tests/contexts/**/*.ts"]`, the code map's own proposal (`target/code-map/harness-and-repo.md:63`), so it loads with any context edit. Cost accepted: the templates load on every context edit; the alternative (memory plus a pointer rule) would be an exception to that row.

Outline:

1. Purpose and status: the strict reference; a deviation is a written exception in section 9 or a change to this page, in the PR that needs it; what counts as an exception and as an ambiguity (the definitions of this plan).
2. Folder layout: the five folders, what each holds and may import, the 10-files-per-folder limit and grouping by subfolder past it.
3. Command template: one file, one class named by intent with a verb, a public `execute`, taking a `XCommand` or nothing, returning `XResult` declared in the same file; private sub-functions; a command orchestrates, the aggregate decides; errors rise, typed from `kernel/errors.ts`. Constructor cap: 5, held by `orchestrator-deps.arch.test.ts` (`MAX_CONSTRUCTOR_DEPENDENCIES`, `:9`) on every `application/` folder.
4. Domain template, provisional until `installation` and its `Manifest` aggregate migrate (auth's aggregate has little behaviour): aggregate with its invariants and behaviour as functions next to it; value objects; the domain holds rules and order, never memoization, logging or a clock; no Node builtin but `node:path` and `node:crypto`, no third party, no `process`; a `glossary.md` at the context root, in English.
5. Ports and contract: a port declared by the side that needs it, named by capability, one interface per file; a contract file has an importer outside the context; types a non-context needs live in `contract/`, never reached through `domain/` or a re-export; a contract implementation that is not a command (`CachedTokenProvider`) lives in `application/` (E5); an adapter outside the context matches a port by shape and is wired by the composition root.
6. Kit template: `tests/contexts/<ctx>/testing/`, one subject per file, fakes that keep what the port keeps, builders with a neutral double per dependency, never imported by another context's tests.
7. Contract-suite template: `describe<Port>Contract(subjectName, makeSubject, knownDivergences?)` in the kit, one `*.contract.test.ts` under `tests/contexts/<ctx>/ports/` calling it on the fake and on the real adapter; only cases the port itself can drive; a case red on the real adapter is a wrong case, red on the fake a divergence fixed in the fake; a real arm a platform cannot run is skipped by `it.skipIf` with its reason (E2).
8. Naming, tests and mutation: file and class names, levels and suffixes, `describe` a situation and `it` an observable result, the test challenge pass and its table; a migrated context's mutation scope is not gated per PR unless it is `telemetry` or `shared` (`target/07-test-architecture.md:356`), which is the target; until the mutation trigger changes, every scope a change touches gates (`cli/aidd_docs/memory/coding-assertions.md`).
9. Rules in force, each with its mechanism and planted tree; the exceptions with their cited line and reason; the ambiguities removed with their two cited lines; the migration state, apart (M3: the context imports `kernel/` where the target has `shared/`; M4: presentation reaches `createDeps` in `runtime/wiring/`), which is not an exception of the model: it vanishes when `kernel/` and `runtime/wiring/` move in stage C, and the old-layout counter only lets it go down.
10. Checklist for the PR that migrates a context: path-naming files, `ALLOWED` and `BASELINE`, the mutation scope, memory and rules that move with the code.

## Doc updates promised

Phase 10 writes these; the text is the content, adjusted only to the measured counts.

In `target/07-test-architecture.md` section 9, a paragraph after the table:

> Every PR that migrates a context delivers its test challenge pass, as a deliverable of the PR and not a review comment: (1) the deterministic pre-filter run on the context's tests (unique coverage per test file, measured with and without each file; `jscpd` on the tests; tests with no assertion, through `--expect.requireAssertions`; duplicate titles), whose output is a list of candidates and never a verdict; (2) an inverted proof for every deletion: the behaviour the test names is broken by hand, another named test turns red, and both are written down; a test deleted with the code it tested names the test that now holds the behaviour; (3) the traceability table, one row per test before and after, with its verdict and its proof; (4) the counts: tests and lines before and after, kept, rewritten, merged, moved to the kit, deleted with their code, deleted by proof, added. A deletion without its proof is not merged.

In `target/00-overview.md` section 12, stage B deliverable 2 gains "with its test challenge pass (pre-filter, inverted proof per deletion, traceability table, counts)", and stage C gains "Each context PR carries the test challenge pass defined in `07-test-architecture.md` section 9." The same section's "13 source files ... Only 6 files outside it import it", "175 tests in total" and "`auth` talks to GitHub only through the `gh` CLI" are corrected to 10 importers, 121 auth tests (138 before foundations moved the 17 token-check tests to `shared`), and "auth checks a token through `gh` and through one GitHub API call, `/user`" (SF12).

## Before and after, and go or no-go

Phase 11 re-measures every baseline line with the same command and fills Appendix B.

| Measure | Before | How after is measured | Go if |
| --- | --- | --- | --- |
| Test lines (auth tests, kit, helpers, wiring and display tests) | 1,786 (on the foundations base) | `wc -l` on the final test tree and kit | lower than before (`target/00-overview.md:197`) |
| Files touched to add a credential source | measured in phase 1 (6 predicted: 4 code and test, 2 docs) | the same throwaway-copy measurement on the final tree, code and docs counted apart | fewer code files and fewer docs (3 predicted: 2 code and test, 1 doc) |
| Exceptions against ambiguities removed | pre-registered below: 7 exceptions, 7 ambiguities (go, at the limit) | the lists of the reference section 9 after phase 10; an entry added during execution names the phase that found it and is accepted by the reviewer, not the executor | exceptions not more than ambiguities (`target/00-overview.md:197`) |
| Source files and lines | 15 files, 586 lines (auth 447, presentation 139), plus about 15 lines of auth in `framework.ts` | `wc -l` | reported |
| Tests and their time | 121 tests, 229 ms vitest (one run; phase 1 takes three) | same vitest command, three runs | reported; the pilot claims no time gain (`target/00-overview.md:185`) |
| Mutation | `auth` 95.76 computed (96.27 with `gh-token-adapter.ts`, measured before foundations); `runtime` without auth 89.16 computed on the new base | `sbx node scripts/run-mutation.mjs auth --force`, `... runtime --force` | both at or above their floor |
| Constructor widths | 5, 4, 1, 1, 1 | reading | none over 5 (`orchestrator-deps`, `MAX_CONSTRUCTOR_DEPENDENCIES = 5`) |
| Contract suites | 0 fakes checked against an adapter | `describe*Contract` calls | 3 ports, each on fake and real |

Definitions, applied before execution:

- An exception is any deviation from a cited line of `target/00-overview.md`, `05`, `07` or `08` (or the code map) that the pilot needs and that survives the pilot. A deviation forced by settling an ambiguity counts as that ambiguity, not twice.
- An ambiguity removed counts only if it cites two lines that conflict (target documents, the code map, the code or the landed memory) and the plan picks one with evidence.

Exceptions, pre-registered:

| # | Deviation | Cited line it deviates from | Why |
| --- | --- | --- | --- |
| E1 | `framework -> auth` in `ALLOWED` | `target/00-overview.md:43-52` (no such edge) | framework hosts the doctor and setup scenarios that import `TokenProvider` until it splits (`doctor-layout-use-case.ts:2`, `setup-marketplace-registration-use-case.ts:6`) |
| E2 | the `gh` contract's real arm runs on POSIX only | `target/07-test-architecture.md:136` (every suite called on the fake and the real adapter) | `spawnSync` without a shell resolves no `.cmd`; the repository fakes binaries with `#!/bin/sh` only (`native-plugin-cli-adapter.codex.integration.test.ts:11`) |
| E5 | `CachedTokenProvider`, not a command, sits in `application/` | `target/00-overview.md:62` (`application/` holds the commands) | the published `TokenProvider` needs an implementation with memo and logs, which the domain may not hold (SF6) |
| E6 | R1b counts any importer outside the context | `target/00-overview.md:63` ("imported by at least one other context") | presentation is a consumer of the context's types (SF8) |
| E8 | two port layouts coexist: `ports/` in auth, `domain/ports/` elsewhere | `target/05-distribution-auth-update.md:118`, `target/code-map/src-runtime-kernel-presentation-distribution.md:3` | one context per PR (`target/00-overview.md:201`) |
| E9 | auth keeps its own permission code; shared private storage not adopted | `target/05-distribution-auth-update.md:213,351` (decision 4) | its port is `telemetry/domain/ports/private-storage.ts` (`private-storage-adapter.ts:4`): adopting it creates `auth -> telemetry`; and adoption would change frozen surface: `PrivateStorage` has no read and no delete (`telemetry/domain/ports/private-storage.ts:2-10`), and its adapter grants `(OI)(CI)F` on a directory made `0700` on POSIX (`private-storage-adapter.ts:41-55`), where auth grants `(R,W)` on the file (`auth-storage.ts:45`; `target/00-overview.md:228`) |
| M1 | `shared/ports/http-get.ts` has one importing context, distribution (`github-raw-fetcher-adapter.ts:12`); auth receives `GitHubAdapter`, it does not import `HttpGet` | rule 8, `target/00-overview.md:69`; `target/05-distribution-auth-update.md:62` | created by foundations, survives the pilot; ends when `update` migrates |

Ambiguities removed, pre-registered:

| # | Line one | Line two | Settled by |
| --- | --- | --- | --- |
| A1 | `target/00-overview.md:195` ("talks to GitHub only through the `gh` CLI") | `target/05-distribution-auth-update.md:179` and `shared/infrastructure/github-adapter.ts:8` (`https://api.github.com/user`) | D2 |
| A2 | `target/05-distribution-auth-update.md:151` (one resolution order, "repeated" in `auth-storage.ts:62`) | `auth-storage.ts:73-75` against `auth-reader-adapter.ts:52-66` (two stop rules) | D4 |
| A3 | `target/05-distribution-auth-update.md:155,211` (`CredentialSession` domain service) | `target/00-overview.md:107` ("a command orchestrates, the aggregate decides") with `target/05-distribution-auth-update.md:158` (the commands are 9 to 15-line delegates) | D5 |
| A4 | `target/05-distribution-auth-update.md:158,210` (`AuthLogin`, `auth-login.ts`) | `target/08-guardrails-and-repo-map.md:201` ("a command carries a verb (`RemovePlugin`)") | D6 |
| A6 | `target/code-map/tests-telemetry-presentation-e2e-helpers-architecture-golden-fixtures.md:109` (`FakeAuthReader` into the auth kit) | `target/07-test-architecture.md:113` (a test never imports another context's kit), its only importer being a framework test | D8 |
| A7 | `target/07-test-architecture.md:136` (`runXContract(makeSubject)`) | `cli/aidd_docs/memory/testing.md` "Contract" (`describe<Port>Contract(subjectName, makeSubject)`, landed) | kit naming above |
| A8 | `target/code-map/tests-tools-translate-distribution-runtime-kernel.md:151-152` (contract tests under `infrastructure/`) | `target/code-map/tests-telemetry-presentation-e2e-helpers-architecture-golden-fixtures.md:122-123` (under `ports/` and `domain/ports/`) | contracts under `tests/contexts/auth/ports/` |

A5 of the first version (where presentation gets types) is gone: SF8 resolves it by E6, and it cites no conflicting pair. A1 and A4 pass the definition (two cited lines each) and stay.

Migration state, registered apart and not counted (the person's decision, recorded before execution):

| # | Deviation | Cited line | Why it is not an exception of the auth model |
| --- | --- | --- | --- |
| M2 | `shared/ports/environment.ts` has one consumer, framework, until the pilot | rule 8, `target/00-overview.md:69` | closed by the pilot itself: `CheckStatus` and `CachedTokenProvider` are its second consumer, so it does not survive the pilot |
| M3 | auth imports `kernel/` (errors, `Logger`, `AIDD_DIR`) where the target has `shared/` | `target/00-overview.md:20,24` | `kernel/` moves to `shared/` in stage C; `old-layout-count.arch.test.ts` freezes `kernel/`'s path set, so it only goes down |
| M4 | presentation reaches `createDeps` in `runtime/wiring/` where the target has `cli.ts` hand it the container | `target/03-orchestration-composition-presentation-shared.md:123` | `runtime/wiring/` moves to `composition/` in stage C; the counter holds `runtime/`'s count down |

The reference lists M3 and M4 as migration state (outline section 9), not as exceptions.

Verdict recorded before execution: 7 exceptions (E1, E2, E5, E6, E8, E9, M1) against 7 ambiguities removed: go, at the limit. Foundations removed E3, E4 and E7 (`plan-foundations.md`, "Exceptions E1 to E9 after this PR"); the person decided that M3 and M4 are migration state. Any exception found during execution is added to this list, names the phase that found it, and flips the verdict to no-go; the executor may not reclassify an entry, and only the reviewer accepts an addition.

## Phases

| # | Phase | Model | Depends on |
| --- | --- | --- | --- |
| 1 | Baseline capture | haiku | none |
| 2 | Freeze behaviour: characterization | sonnet, opus reviews the proofs | 1 |
| 2b | Owner-only creation of the credential file | sonnet, opus reviews | 2 |
| 3 | Seams in place, before any move | sonnet | 2b |
| 4 | Move into `contexts/auth`, names unchanged | sonnet, opus reviews the architecture data | 3 |
| 5 | Rename to the target names | sonnet | 4 |
| 6 | Domain, application, kit and wiring, seven steps | opus designs, sonnet edits | 5 |
| 7 | Presentation under the code-size limits | sonnet | 6 |
| 8 | Contract suites and the rest of the challenge pass | sonnet, opus reviews each deletion | 6 |
| 9 | Rules in force with planted trees | sonnet, opus reviews | 6, 8 |
| 10 | Reference, memory, rules, target docs | opus writes the reference, sonnet edits | 9 |
| 11 | Gates, after measures, go or no-go | haiku runs, opus judges | 10 |

### Phase 1: Baseline capture (haiku)

Files: none in the repository. Output in `$B`.

1. Lines into `$B/src-lines.txt` and `$B/test-lines.txt` (`wc -l` of the files of the baseline table).
2. Tests and time: the vitest command of the baseline with `--reporter=json --outputFile="$B/tests.json"`, three plain runs, `--expect.requireAssertions` once.
3. Coverage and leave-one-out, under `bash` (zsh does not split an unquoted list): coverage of `src/runtime/auth/**`, `src/presentation/commands/auth.ts`, `src/presentation/display/auth-display.ts` with every auth test file into `"$B/cov-all"`, then once without each file into `"$B/cov-wo-<file>"`, `--coverage.reporter=json` and the four `--coverage.thresholds.*=0`; compare covered statements and branches of `coverage-final.json`.
4. Mutation, two runs, each from a temp stryker config deleted after: `mutate: ["src/runtime/auth/**/*.ts"]`, then `["src/runtime/**/*.ts", "!src/runtime/auth/**/*.ts"]`; `incremental: false`, its own `tempDirName`, JSON report under `reports/mutation/<name>/` (gitignored); `sbx npx stryker run <config>`.
5. `jscpd` and duplicate titles.
6. `size_check` on the current files.
7. `sbx npx vitest run --project=architecture` and the `weighedEdges` output for the two `runtime` edges.
8. The credential source, before: the throwaway-copy measurement, into `$B/source-before.txt`.

Acceptance: `ls "$B"` lists each output; `git status --short` prints the plan file as untracked (`?? aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-pilot-auth.md`) and nothing else.

### Phase 2: Freeze behaviour, characterization (sonnet; opus reviews the proofs)

Behaviours no test pins today, found by reading. Each test is green by construction, so each gets its inverted proof: the break, then only this test turns red (if another also does, one of the two is redundant and Appendix A says which).

| Test | Where | Behaviour | Break for the proof |
| --- | --- | --- | --- |
| C1 | `tests/runtime/auth/auth-provider-adapter.unit.test.ts`, "logging in with a stored token" › stores nothing when the token check refuses | verify before save (`auth-provider-adapter.ts:22-26`) | swap the two statements of `login` |
| C2 | `tests/runtime/auth/auth-logout-use-case.integration.test.ts` › with a record at both levels, removes the project one and keeps the user one | logout stops at the first level (`:39-47`) | delete the `return` at `:42-46` |
| C3 | `tests/runtime/auth/auth-storage.integration.test.ts`, "readActive" › answers a project record that carries no token ahead of a user record that does | the status stop rule (`auth-storage.ts:73-75`) against the token rule (`auth-reader-adapter.ts:52-66`) | make `readActive` skip a record without a token |
| C4b, C4c, C4d | `tests/presentation/commands/auth.integration.test.ts` (new), `tests/helpers/in-process-cli.ts`, env `{ AIDD_TOKEN: "", PATH: <empty temp dir> }`, no network: (b) project and user records seeded, `auth logout` prints `Logged out (project)` and the user file remains; (c) `auth login --gh --level project` exits 1, stderr names `Authentication failed (gh CLI)`, no file written, `it.skipIf(process.platform === "win32")` (Windows reads `Path`, the helper sets `PATH`, `tests/e2e/helpers.ts:244`); (d) only a user record seeded, `auth logout` prints `Logged out (user)` and the file is gone | the real wiring, which no test drives (`auth-wiring.integration.test.ts:12-18` mocks `createDeps`) | (b) hand the store `dirname(projectRoot)` (`framework.ts:233`); (c) register the provider map without `gh` (`framework.ts:231`); (d) build the store with `() => homedir()` instead of `userConfigDir` (`framework.ts:220`; the in-process helper relocates `HOME`, so the break reads the sandbox home, never the real one) |
| C5 | `tests/runtime/auth/auth-storage-shape.integration.test.ts` › writes a stored and an external record as these exact bytes | key order of `save` (`auth-storage.ts:79-87`) and two-space print (`:39`); `toStrictEqual` ignores key order (`auth-storage-shape.integration.test.ts:58,78`) and the print case goes through `write` (`:39-45`); compared with two literal strings captured from the current code, `createdAt` replaced by a fixed value | move `createdAt` before `method` in `save` |

No case verifies a stored token: that calls `https://api.github.com/user`. A status-with-nothing-stored case is left out: no break of the wiring turns it red that does not also turn C4b red.

Acceptance:

```sh
cd cli && sbx npx vitest run tests/runtime/auth tests/presentation/commands/auth-wiring.integration.test.ts tests/presentation/commands/auth.integration.test.ts tests/presentation/display/auth-display.unit.test.ts
# expected: 128 tests pass (121 + C1, C2, C3, C4b, C4c, C4d, C5); 127 on Windows
sbx npx vitest run --project=architecture   # expected: green
```

### Phase 2b: Owner-only creation of the credential file (sonnet; opus reviews)

The one behaviour change of the pilot (SF1). Today the file is written with the default mode and restricted afterwards (`auth-storage.ts:38-55`), so it is readable under the umask in between.

1. C6, red first: `tests/runtime/auth/auth-storage-create-mode.integration.test.ts`, `vi.mock("node:fs/promises")` keeping the real module but making `chmod` a no-op, `process.umask(0o022)` set and restored, `it.skipIf(process.platform === "win32")`: a newly written credential file has mode `0600`. Run it: red (`0644`).
2. `auth-storage.ts:39`: `writeFile(path, ..., { encoding: "utf-8", mode: 0o600 })`. C6 green.
3. C7, in `auth-storage.integration.test.ts`: an existing file at `0644` is rewritten and ends `0600`. Green at once (it pins the kept `chmod`); proof: remove the `chmod` call => C7 red, C6 stays green.
4. Temp file plus rename stays out of the pilot (deferred with shared private storage, E9).

Acceptance:

```sh
cd cli && sbx npx vitest run tests/runtime/auth   # expected: green, C6 and C7 included (130 in the phase 2 set, 128 on Windows)
```

### Phase 3: Seams in place, before any move (sonnet)

Foundations already moved `HttpGet`, `HttpClient`, `Environment` and `GitHubAdapter` into `shared/`. One seam is left: moving `auth-storage.ts` unchanged would create an `auth -> runtime` edge, which may not enter `ALLOWED` nor be a new `BASELINE` entry, through its import of `runtime/user-config-dir.ts` (`auth-storage.ts:6`; `crossings` counts type imports, `helpers.ts:185-199`). `shared` is not a crossing (`isCrossing`, `helpers.ts:178-182`), so auth may import `shared/ports`.

Files:

- `src/runtime/auth/auth-storage.ts`: `constructor(private readonly userConfigDir: () => string)`; the import of `../user-config-dir.js` leaves.
- `src/runtime/wiring/framework.ts:220`: `new AuthStorage(userConfigDir)`.
- `src/shared/infrastructure/github-adapter.ts`: `constructor(private readonly http: HttpGet, private readonly apiBase = "https://api.github.com")`, URL `${this.apiBase}/user` (`:5,8`); `tests/shared/infrastructure/github-adapter.unit.test.ts` gains the case "asks the base it was given", red first. No product caller passes another base.
- `tests/helpers/auth.ts`: `makeTempAuthStorage` builds `new AuthStorage(() => tempDir)`, user file `auth.json` under `tempDir`, replacing the `Object.create` override (`:13-15`); the storage and logout tests construct with an explicit directory.
- `auth-storage.integration.test.ts` › `userConfigPath respects AIDD_USER_CONFIG_DIR env override` becomes `writes the user record under the directory it was given`.
- `runtime` survivors: phase 1 measured `runtime` without auth (computed 89.16, 625 of 701; 631 needed for 90). Before phase 4, tests that kill named survivors of that report, outside `runtime/wiring` first (`runtime/filesystem`, `runtime/project-root`, `runtime/self-update`), each seen red against its mutant, until the measure reads at least 90. The floor is not lowered (D11).

Acceptance:

```sh
cd cli && sbx npx vitest run tests/runtime/auth tests/presentation/commands/auth-wiring.integration.test.ts tests/presentation/commands/auth.integration.test.ts tests/presentation/display/auth-display.unit.test.ts
# expected: 130 tests, the same file set as phase 2 plus C6 and C7; 128 on Windows (C4c, C6 skipped)
sbx npx vitest run tests/shared/infrastructure/github-adapter.unit.test.ts   # expected: 18 (17 + apiBase)
sbx npx vitest run --project=architecture && pnpm typecheck && pnpm lint   # expected: green
grep -n "user-config-dir" src/runtime/auth/auth-storage.ts   # expected: nothing
# runtime without auth, temp stryker config, mutate: ["src/runtime/**/*.ts", "!src/runtime/auth/**/*.ts"]
sbx npx stryker run <config>   # expected: at least 90.00, written to $B/runtime-after-phase-3.txt
```

### Phase 4: Move into `contexts/auth`, names unchanged (sonnet; opus reviews the architecture data)

`git mv`, contents unchanged except import specifiers:

| From `src/runtime/auth/` | To `src/contexts/auth/` |
| --- | --- |
| `auth.ts` | `domain/auth.ts` |
| `auth-login-use-case.ts`, `auth-logout-use-case.ts`, `auth-status-use-case.ts` | `application/` |
| `auth-reader-adapter.ts`, `auth-provider-adapter.ts`, `auth-storage.ts`, `gh-cli-adapter.ts` | `infrastructure/` (they read `process.env`, which the `noRestrictedGlobals` override refuses in `domain/` and `application/`) |
| `ports/credential-store.ts`, `ports/credential-file-store.ts`, `ports/oauth-provider.ts` | `ports/` |
| `ports/token-provider.ts` | `contract/` |

Tests: `tests/runtime/auth/*` => `tests/contexts/auth/{application,infrastructure}/` mirroring the sources, names unchanged. Importers: the 10 files of the baseline and the test files importing `runtime/auth` (`setup-auth-guard.unit.test.ts:20`, `setup-marketplace-registration-use-case.unit.test.ts:11`, `plugin-fetcher-cache-and-auth.unit.test.ts:46`, `tests/helpers/auth.ts:4-5`, `tests/helpers/ports/fake-auth-reader.ts:1`).

Architecture data, same phase: `ALLOWED` and `BASELINE` (R2); `old-layout-count.arch.test.ts` `COMMITTED_COUNTS["src/runtime/"]` 37 to 25 (the 12 files of `runtime/auth`); `0-hexagonal.md:26`; `LAYER_OF_FILE`; `PUBLIC_MODULES.auth` listing the modules imported from outside now (`domain/auth.ts`, `ports/credential-store.ts`, `contract/token-provider.ts`, the three use cases), each with its reason; `biome-context-parity.arch.test.ts` optional layers (R5); `biome.json`: the five auth overrides and `**/auth/**` in the 9 overrides of the three contexts auth does not serve; the planted `tools -> auth` and `distribution -> auth` cases; the checklist rows of phase 4; mutation scope `auth`, floor = `sbx node scripts/run-mutation.mjs auth --force` measured now (about 95.76 expected: 271 of 283 without `gh-token-adapter.ts`).

Acceptance:

```sh
cd cli && test ! -e src/runtime/auth && echo moved
sbx pnpm test:unit && sbx pnpm test:contract && sbx pnpm test:integration && sbx pnpm test:arch
pnpm typecheck && pnpm lint && pnpm knip && (cd .. && node scripts/check-cli-type-honesty.mjs)
sbx node scripts/run-mutation.mjs auth --force && sbx node scripts/run-mutation.mjs runtime --force
# expected: green; both mutation scores at or above their floor
```

### Phase 5: Rename to the target names (sonnet)

Identifiers and file names only, `git mv`, test files renamed with their subject. Classes and ports that phase 6 deletes keep their names (`AuthProviderAdapter`, `CredentialStore`, `CredentialFileStore`): renaming them would be work thrown away.

| Current | Target |
| --- | --- |
| `domain/auth.ts`, `AuthConfig`, `AuthCredential` | `domain/credential-record.ts`, `CredentialRecord`, `Credential` |
| `infrastructure/auth-reader-adapter.ts`, `AuthReaderAdapter` | `infrastructure/cached-token-provider.ts`, `CachedTokenProvider` (split and moved in 6.4) |
| `infrastructure/auth-storage.ts`, `AuthStorage` | `infrastructure/credential-record-file-adapter.ts`, `CredentialRecordFileAdapter` |
| `ports/oauth-provider.ts` | `ports/external-token-source.ts` (`ExternalTokenSource`, method `read`), `ports/cli-auth-provider.ts` (`CliAuthProvider`), `ports/identity-verifier.ts` (`IdentityVerifier`) |
| `application/auth-login-use-case.ts`, `AuthLoginUseCase` | `application/log-in.ts`, `LogIn` |
| `application/auth-logout-use-case.ts`, `AuthLogoutUseCase` | `application/log-out.ts`, `LogOut` |
| `application/auth-status-use-case.ts`, `AuthStatusUseCase` | `application/check-status.ts`, `CheckStatus` |

`orchestrator-deps.arch.test.ts` and `earned-sharing.arch.test.ts` select `application/` by path, not by suffix (`orchestrator-deps.arch.test.ts:116-118`, `earned-sharing.arch.test.ts:17-20`); their candidate counts are checked unchanged.

Acceptance: phase 4's commands; `grep -rn "AuthConfig\|AuthCredential\|AuthReaderAdapter\|AuthStorage\b\|TokenAuthProvider\|TokenResolver" src/contexts/auth` prints nothing. `GitHubAdapter` keeps its name (foundations).

### Phase 6: Domain, application, kit and wiring (opus designs, sonnet edits)

Seven steps, each green before the next. `T6` is the auth test set: `tests/contexts/auth tests/shared/infrastructure/github-adapter.unit.test.ts tests/presentation/commands/auth-wiring.integration.test.ts tests/presentation/commands/auth.integration.test.ts tests/presentation/display/auth-display.unit.test.ts`.

6.1. Kit and contract types: the kit files `credential-records.ts`, `in-memory-credential-record-repository.ts`, `fake-identity-verifier.ts`, `fake-cli-auth-provider.ts`, `auth-builders.ts`; `contract/credential.ts` takes `AuthLevel`, `AuthMethod`, `Credential` out of `domain/credential-record.ts`, which imports them. Acceptance: `sbx npx vitest run $T6 && pnpm typecheck && pnpm lint` green.

6.2. Aggregate behaviour: `parseCredentialRecord`, `recordCredential`, `removalHint`, `providerOf`, `storedTokenOf`, `LEVELS_BY_PRECEDENCE` in `credential-record.ts`; the adapter's read uses the parse; `AuthProviderAdapter` calls the three rules. Tests `domain/credential-record.unit.test.ts` (#44-51, N1, N18), each seen red. Acceptance: `sbx npx vitest run $T6` green, `grep -n "isAuthConfig" src/contexts/auth` nothing.

6.3. Level-keyed repository beside the old: new port `ports/credential-record-repository.ts`; `CredentialRecordFileAdapter` implements it and still implements `CredentialFileStore`; constructor gains the clock; `save(credential, level)` writes the C5 bytes. Adapter integration cases for the new methods written red first. Acceptance: `sbx npx vitest run $T6` green; C5, C6, C7 green.

6.4. Sources and token provider switch: `domain/credential-sources.ts`; `application/cached-token-provider.ts` over the new port, `SuppliedTokens` (`commandLine`, `environment` from `shared/ports/environment.ts`); `resolveContext` and the default provider deleted; `src/composition/auth.ts` created with `wireAuth` (token provider only), called by `framework.ts`, which passes it the `environment` it builds (`framework.ts:244`, so the construction moves above the auth block); in the same step, rule R7 with its plants, `src/composition/**` in the coverage exclude and in `mutation-scopes.json` `excluded`, `0-deps-wiring.md` rewritten and the `composition/` line of `0-contexts.md`. Tests `domain/credential-sources.unit.test.ts` and `application/cached-token-provider.unit.test.ts` from the reader rows of Appendix A; the old reader tests deleted with their rows proven. Acceptance: `sbx npx vitest run $T6 tests/contexts/distribution tests/contexts/framework/application/doctor` green; `grep -rln "AIDD_TOKEN" src` lists `credential-sources.ts` and the instruction text of `plugin-fetcher-adapter.ts:188` only; `sbx pnpm test:arch` green with R7's plants.

6.5. Commands switch: `LogIn`, `LogOut`, `CheckStatus` on the new port and the domain; `AuthProviderAdapter`, `ports/credential-store.ts` and the pass-through tests deleted; `wireAuth` returns the three commands; `Deps` exposes them and loses `authReader` and `credentialStore`; `distribution.ts` takes `tokenProvider`; presentation calls `deps.logIn` and the others and imports `contract/credential.ts` and `application/` only; `auth-wiring.integration.test.ts` mock follows; `fake-auth-reader.ts` and `helpers/ports/index.ts:4` deleted, `doctor-layout-use-case.unit.test.ts` doubles inline; `glossary.md` written. Tests `log-in.unit` (with C1, N17), `log-out.unit` (with C2, N3), `check-status.unit`. Acceptance: `sbx pnpm test:unit && sbx pnpm test:integration` green, C4b, C4c, C4d green.

6.6. Old methods out: `read(path)`, `write`, `readActive`, `save(options)`, `projectConfigPath`, `userConfigPath` leave the adapter's public surface; `ports/credential-file-store.ts` and `tests/helpers/auth.ts` deleted. Acceptance: `grep -rn "readActive\|CredentialFileStore\|projectConfigPath\|userConfigPath" src tests` prints nothing; `sbx pnpm test:unit && sbx pnpm test:integration && sbx pnpm test:arch` green.

6.7. Surface and mutation: `PUBLIC_MODULES.auth` narrowed to `application/` and `contract/` files; `sbx node scripts/run-mutation.mjs auth --force` and `... runtime --force` (the auth construction leaves `runtime/wiring/framework.ts` for `composition/auth.ts`, excluded from mutation, so `runtime` loses wiring mutants that only in-process tests drove, `vitest.mutation.config.ts:16-35`): a score under its floor is answered by a test killing each named survivor, each seen red against its mutant. Acceptance:

```sh
cd cli && sbx pnpm test && pnpm typecheck && pnpm lint && pnpm knip && (cd .. && node scripts/check-cli-type-honesty.mjs)
size_check src/contexts/auth/*/*.ts src/composition/auth.ts src/shared/infrastructure/github-adapter.ts   # nothing
grep -rn "process\." src/contexts/auth/domain src/contexts/auth/application   # nothing
sbx node scripts/run-mutation.mjs auth --force && sbx node scripts/run-mutation.mjs runtime --force   # at or above floor
```

### Phase 7: Presentation under the code-size limits (sonnet)

`src/presentation/commands/auth.ts`: the `login` action becomes `refuseInvalidOptions(cmdOptions, output)` (the four refusals, same messages, same order, `:27-43`), `askLevel(prompter, rawLevel)`, `askCredential(prompter, cmdOptions)`; each under 50 lines and complexity 15, at most 3 parameters. Held by `auth-wiring.integration.test.ts` (22 tests, 70 statements and branches only it covers) and C4.

Acceptance: `size_check src/presentation/commands/auth.ts` prints nothing; `sbx npx vitest run tests/presentation/commands` green; whichever of this branch and `chore/code-size-rules` lands second deletes `!src/presentation/commands/auth.ts` from that branch's two baselines.

### Phase 8: Contract suites and the rest of the challenge pass (sonnet; opus reviews each deletion)

A contract suite holds the port's promise, in cases the port itself can drive; adapter translation stays in the adapter's test (D15, D17).

1. `describeCredentialRecordRepositoryContract`; `tests/contexts/auth/ports/credential-record-repository.contract.test.ts` on `InMemoryCredentialRecordRepository` and on `CredentialRecordFileAdapter` over `mkdtemp(join(tmpdir(), "aidd-auth-"))`. Cases: nothing stored reads null per level; save then read per level; a stored credential keeps its token and no provider, an external one its provider and no token; deleting a level removes it and leaves the other; deleting nothing does not throw.
2. `tests/contexts/auth/infrastructure/credential-record-file-adapter.integration.test.ts`: the C5 bytes; an unreadable file and a file the parse refuses read as null (SF10); parents created; the project and user paths; `0600` on POSIX with C7; the four win32 cases. C6 stays in its own file (`chmod` mocked module-wide), renamed `credential-record-file-adapter-create-mode.integration.test.ts`.
3. `describeIdentityVerifierContract`; `tests/contexts/auth/ports/identity-verifier.contract.test.ts` on `FakeIdentityVerifier` and on `GitHubAdapter(new HttpClient(), <local server base>)` (both from `shared/infrastructure/`) with a `node:http` server answering a recorded `/user` body. Cases: a known token answers its login; a refused token throws `AuthenticationError("GitHub API")`; the refusal never carries the token (a boolean, never printed).
4. `describeCliAuthProviderContract`; `tests/contexts/auth/ports/cli-auth-provider.contract.test.ts` on `FakeCliAuthProvider` and on `GhCliAdapter` with a fake `gh` (`#!/bin/sh`, `0755`, in a temp dir that is the whole `PATH`, the precedent of `native-plugin-cli-adapter.codex.integration.test.ts:11-13`). Cases: a token answers it; absent answers null; a failure throws; `verify` answers a login or refuses. Real arm `describe.skipIf(process.platform === "win32")` (E2).
5. `tests/contexts/auth/infrastructure/gh-cli-adapter.integration.test.ts`: the two current files merged, `spawnSync` mocked.
6. Old adapter test files deleted once their rows carry a proof; `scripts/sweep-stale-test-dirs.cjs` loses `auth-storage-test-`; `cli/aidd_docs/memory/testing.md` "Contract" names the per-context kit and placement.
7. Mutation re-run; a floor is raised to a higher measured score, never lowered; a lower score is answered by tests for the named survivors.

Acceptance:

```sh
cd cli && sbx pnpm test:contract && sbx npx vitest run tests/contexts/auth tests/shared/infrastructure/github-adapter.unit.test.ts
sbx node scripts/run-mutation.mjs auth --force && sbx node scripts/run-mutation.mjs runtime --force
find tests/contexts/auth -name '*.test.ts' | xargs wc -l   # every file under 400
```

### Phase 9: Rules in force with planted trees (sonnet; opus reviews)

R1, R1b, R4, R6 as tabled (R3 is gone: `orchestrator-deps` caps every `application/` at 5; R7 entered in 6.4). For each: write the plant, run it with the rule absent (not reported: red), add the rule (reported: green), confirm the real tree clean.

Acceptance:

```sh
cd cli && sbx pnpm test:arch && pnpm lint
grep -n "auth" tests/architecture/context-boundary.arch.test.ts   # only HELD_BY_BIOME and the guard's plants
```

### Phase 10: Reference, memory, rules, target docs (opus writes the reference, sonnet edits)

Files:

- `cli/.claude/rules/cli-contexts/reference-context.md` (new, outline above) and `cli/.claude/rules/cli-contexts/auth.md` (moved from `07-quality/7-auth.md`).
- `cli/aidd_docs/memory/internal/auth.md` (moved from `memory/auth.md`): paths, the order stated once, the two stop rules, `gh`-only external resolution as a limit, owner-only creation; every importer and link of the old path updated (`cli/CLAUDE.md`, `cli/aidd_docs/memory/README.md`, `cli/aidd_docs/memory/ecosystem.md`).
- `cli/.claude/rules/00-architecture/0-contexts.md`, `0-hexagonal.md`, `0-shared-modules.md`, `cli/.claude/rules/01-standards/1-conventions.md`: one line each scoping their `domain/ports/`, `PUBLIC_MODULES` and `-use-case.ts` wording to contexts not yet migrated, pointing to the reference for a migrated one; rewriting them is the guideline PR's (`target/00-overview.md:164`).
- `cli/aidd_docs/memory/codebase-map.md`, `architecture.md`: final.
- `target/07-test-architecture.md` section 9 and `target/00-overview.md` section 12: the passages and corrections above (SF12); `target/05-distribution-auth-update.md` section 2 notes where D2, D5, D6 and SF6 replaced its mapping.

Acceptance: `pnpm exec lefthook run pre-commit --all-files --force` green, and its output names the markdown-link, referenced-path, doc-duplication, context-import and `cli` jobs as run, not skipped; `sbx pnpm test:arch` green; `git status --short` read after (the hook stages what it regenerates; nothing is committed).

### Phase 11: Gates, after measures, go or no-go (haiku runs, opus judges)

1. Every gate: `pnpm exec lefthook run pre-commit --all-files --force`, `pnpm exec lefthook run pre-push --all-files --force` (output lists the `cli` jobs as run), `(cd .. && node scripts/check-cli-type-honesty.mjs)`, `sbx pnpm test`, `sbx pnpm test:coverage`, `pnpm build`, `pnpm jscpd`.
2. Every baseline command into `$B/after-*`, including the credential-source measurement on the final tree; Appendix B filled; the go or no-go table applied, the exception and ambiguity lists compared with the pre-registered ones.
3. `git status --short`: only the planned files; nothing committed.

## Resources

| Source | Verified |
| --- | --- |
| `git show chore/code-size-rules:cli/.claude/rules/00-architecture/0-code-size.md` and its `biome.json` | the six limits, the plugin files, the baselines naming `presentation/commands/auth.ts` and `runtime/wiring/framework.ts`; `size_check` reproduces both auth findings and reports a planted constructor, function and `process.exit` under `auth/` |
| Biome 2.5.15, `target/08-guardrails-and-repo-map.md` section 1 | last matching override wins; no wildcard on `node:*`; `paths` detects a builtin and a package |
| vitest 5.0.5 | `--expect.requireAssertions` accepted, 138 of 138 (before foundations) |
| lefthook 2.2.2 | `run --all-files` and `--force` exist |

## Decisions

| # | Decision | Why (evidence) |
| --- | --- | --- |
| D1 | Seam before the move (phase 3); the current adapters move to `infrastructure/` first and are lifted only in phase 6 | `auth-storage.ts:6` would create `auth -> runtime` (`helpers.ts:185-199`); foundations removed the `gh-token-adapter.ts:2` half; `auth-reader-adapter.ts:37`, `auth-storage.ts:63` read `process.env`, refused in `domain/` and `application/` |
| D2 | The `/user` check is `shared/infrastructure/github-adapter.ts`, satisfying `IdentityVerifier` by shape (A1) | done by foundations (`plan-foundations.md` phases 2 and 3; doc 05 decision 1); the pilot adds only `apiBase` |
| D3 | Auth takes `Environment` from `shared/ports/environment.ts` and declares none | foundations moved the port and `EnvironmentAdapter` into `shared/` (`target/code-map/src-framework.md:28,37`); the pilot is its second consumer, closing M2 |
| D4 | One source order in the domain, two stop rules kept; memo and logs in `application/` (A2, SF6) | `auth-storage.ts:73-75` against `auth-reader-adapter.ts:43-47,52-66`; logout uses the same level order (`auth-provider-adapter.ts:38-53`) |
| D5 | No `CredentialSession`: the commands orchestrate, the aggregate and the sources decide (A3) | the use cases are one-line pass-throughs (`auth-login-use-case.ts:12-14`, `auth-logout-use-case.ts:6-8`, `auth-status-use-case.ts:6-8`) |
| D6 | `LogIn`, `LogOut`, `CheckStatus` (A4) | a command carries a verb; `CheckStatus` verifies (`auth-provider-adapter.ts:33,57-63`) |
| D7 | Presentation takes `AuthLevel` and `Credential` from `contract/credential.ts` and the results from the command files (SF8, E6) | `display/auth-display.ts:1-2`, `commands/auth.ts:4`; no re-export (`1-conventions.md`) |
| D8 | `FakeAuthReader` deleted, consumers double `TokenProvider` inline (A6) | single importer in framework (`doctor-layout-use-case.unit.test.ts:8`); three consumers already inline |
| D10 | `ports/` and `contract/` only in auth for now; parity checks them where they exist (E8) | one context per PR (`target/00-overview.md:201`) |
| D11 | No floor is lowered in the pilot; a score under a floor is answered by tests killing named survivors before the phase is green | `mutation-scopes.json` `$comment` ("never lowered without the reason here"); `runtime` without auth computes to 89.16 on the foundations base (`plan-foundations.md`, "Measured baseline"): 6 kills, measured first in phase 1 and made in phase 3 |
| D12 | The `gh` contract's real arm runs on POSIX only (E2) | `spawnSync` without a shell resolves no `.cmd`; five files already `it.skipIf(process.platform === "win32")` |
| D13 | The reference and the auth rule live in `cli/.claude/rules/cli-contexts/`, the auth memory in `internal/` | `target/code-map/harness-and-repo.md:61,63,80`, adopted rather than deviated from |
| D14 | Shared private storage not adopted (E9) | its port is `telemetry/domain/ports/private-storage.ts` (`private-storage-adapter.ts:4`) |
| D15 | Contract suites hold the port's promise only; `github-adapter.unit` kept by the relevance rule | a fake that passes the adapter's own wording makes the case circular; the default base URL is asserted only at `tests/shared/infrastructure/github-adapter.unit.test.ts:28` |
| D16 | The credential file is created `0600` in the pilot, `chmod` kept for an existing file (SF1) | `auth-storage.ts:38-55`; `writeFile`'s `mode` applies on creation only |
| D17 | "Unreadable record reads as null" is an adapter and parse case, not a contract case; the fake keeps records (SF10) | the port has no operation that writes an unreadable record; `describeFileContract` seeds through the port itself (`file-port-contract.ts:8-16`) |
| D18 | `ExternalTokenSource.read()` replaces `TokenResolver.resolve()` (S1) | three `resolve` names: `token-provider.ts:2`, `oauth-provider.ts:2`, the resolver class |
| D20 | `wireAuth` lands in `src/composition/auth.ts`, and the step that creates the folder makes it known (R7) | `target/code-map/src-runtime-kernel-presentation-distribution.md:15`; `old-layout-count.arch.test.ts` fails on an unknown top-level area (`KNOWN_SOURCE_AREAS`); foundations deferred the composition guards to this step (`plan-foundations.md`, SF1) |
| D19 | R1 is Biome's; the arch test counts importers and holds the groups to the data (S2) | `target/08-guardrails-and-repo-map.md:44-48` |

## Risks, limits and open questions

What the pilot cannot prove (`target/00-overview.md` section 12), confirmed against the code:

- No HTTP forge port shared by two contexts: `/user` is one call, one consumer.
- No aggregate with real behaviour: `CredentialRecord` has an invariant and three small rules; the domain template stays provisional until `installation` and `Manifest`.
- No aggregate shared by several hosts, no translation, no manifest, no tool profile, no mutation sharding (auth's run is 10 s), and almost no e2e cost: auth has no e2e test (`ls tests/e2e | grep -i auth` finds none; the smoke covers it in CI, `scripts/smoke-tools.sh:192-201`).
- Narrow constructors: the builder pattern of doc 07 section 2.4 is shown, not stressed.
- No time gain: 162 ms before, whatever after.

Risks:

- `runtime` without auth computes to 89.16 on the foundations base: about 6 survivors to kill in phase 3, measured first; the auth construction then leaves `runtime/wiring/framework.ts` for `composition/`, excluded from mutation, which moves `runtime` again (re-measured in 6.7).
- Two branches touch `biome.json` and `helpers.ts` (`chore/code-size-rules` adds `BIOME` and `biomeFindings` to `helpers.ts`, defined locally in `biome-guards-bite.arch.test.ts` today): the second to land rebases; the planted Biome trees use the shared helper once both are in.
- `framework -> auth` must leave `ALLOWED` when framework splits (E1).
- The exceptions criterion sits at the limit (7 against 7): one new exception during execution makes it a no-go.

Open questions the code reveals, each decided here:

| Question | Decision | Evidence |
| --- | --- | --- |
| Status and token resolution disagree on a tokenless project record | kept and characterized (C3); a separate fix for the person to decide | `auth-storage.ts:73-75`, `auth-reader-adapter.ts:52-66` |
| Token resolution always asks `gh`, whatever provider a record names; status honours the name | kept; a limit, only `gh` is ever written | `auth-reader-adapter.ts:58-63` against `auth-provider-adapter.ts:59`; the CLI writes `provider: "gh"` only (`commands/auth.ts:56,62`); the wiring registers `gh` only (`framework.ts:231`) |
| Logout reports the level inside the record, not the file's | kept; a limit, only a hand-edited file differs (N3) | `auth-provider-adapter.ts:44,52` |
| The credential file is readable under the umask until `chmod` | fixed in the pilot, phase 2b (D16); temp file plus rename deferred | `auth-storage.ts:38-55` |
| `.aidd/auth.json` is not in the `.gitignore` lines the CLI writes, so a project-level token can be committed | outside the pilot: a separate fix, in `framework` (the owner of the gitignore list), with its own characterization | `src/contexts/framework/domain/manifest-gitignore-entries.ts:9-14` |
| `auth status` with `AIDD_TOKEN` reports a stored user credential with nothing on disk | kept, documented | `auth-storage.ts:62-72`, `cli/aidd_docs/memory/auth.md` "Sessions" |
| `Deps.authReader` is exported and never read | deleted in 6.5 | `grep -rn "\.authReader" src` |
| Each auth command builds the whole framework graph through `createDeps` | out of scope; `wireAuth` makes a lighter graph possible later | `commands/auth.ts:46,88,104` |

## Appendix A: traceability

Every current test has its row with the planned verdict and target, decided from reading; phases 2, 6 and 8 fill the Proof column (the break applied and the one test that went red, or "seen red once" for a rewritten test) and may change a verdict only with the reason written in the row. Current files are under `cli/tests/runtime/auth/` unless named otherwise; targets are under `cli/tests/contexts/auth/`. Short names:

| Short | File |
| --- | --- |
| `record` | `domain/credential-record.unit.test.ts` |
| `log-in`, `log-out`, `status` | `application/log-in.unit.test.ts`, `application/log-out.unit.test.ts`, `application/check-status.unit.test.ts` |
| `sources` | `domain/credential-sources.unit.test.ts` |
| `provider` | `application/cached-token-provider.unit.test.ts` |
| `repo-contract` | `ports/credential-record-repository.contract.test.ts` |
| `file-adapter` | `infrastructure/credential-record-file-adapter.integration.test.ts` |
| `gh-adapter` | `infrastructure/gh-cli-adapter.integration.test.ts` |
| `github` | `cli/tests/shared/infrastructure/github-adapter.unit.test.ts` (moved by foundations; outside the auth test set) |

Pre-filter flags: `U0` the file has no unique coverage, `D` a duplicate title, `J` part of a `jscpd` clone.

### Characterization, phases 2 and 2b

| # | Current file › title | Behaviour it pins | Verdict | Target file › title | Proof |
| --- | --- | --- | --- | --- | --- |
| C1 | `auth-provider-adapter.unit` › logging in with a stored token › stores nothing when the token check refuses | verify before save | add, then rewrite | `log-in` › when the token check refuses › throws and saves nothing | phase 2: swap verify and save |
| C2 | `auth-logout-use-case.integration` › with a record at both levels, removes the project one and keeps the user one | logout stops at the first level | add, then rewrite | `log-out` › when both levels hold a record › deletes the project one and keeps the user one | phase 2: remove the early return |
| C3 | `auth-storage.integration` › readActive › answers a project record that carries no token ahead of a user record that does | the status stop rule | add, then rewrite | `sources` › the active credential › is a project record even when it carries no token | phase 2: skip tokenless records |
| C4b | `presentation/commands/auth.integration` › logout through the real wiring removes the project record and keeps the user one | auth's real composition | add, keep | same | phase 2: wrong project root in the wiring |
| C4c | `presentation/commands/auth.integration` › login with gh unavailable fails and writes nothing (`it.skipIf(win32)`) | auth's real composition, external path | add, keep | same | phase 2: no `gh` in the provider map |
| C4d | `presentation/commands/auth.integration` › logout through the real wiring removes a user-only record | the user directory the wiring passes | add, keep | same | phase 2: wire the store with `() => homedir()` instead of `userConfigDir` |
| C5 | `auth-storage-shape.integration` › writes a stored and an external record as these exact bytes | key order and pretty-print of `auth.json` | add, then move | `file-adapter` › writing a record › writes these exact bytes | phase 2: reorder `createdAt` |
| C6 | `auth-storage-create-mode.integration` (new, `chmod` mocked module-wide) › creates a new credential file readable by its owner only, before any chmod (`it.skipIf(win32)`) | SF1: the file is created `0600` | add, red first (phase 2b) | `infrastructure/credential-record-file-adapter-create-mode.integration.test.ts` › same title | written red against today's code with `chmod` stubbed to a no-op, green after `writeFile(..., { mode: 0o600 })` |
| C7 | `auth-storage.integration` › write › rewrites an existing world-readable file to owner only | the kept `chmod` for a file that already exists (`writeFile`'s `mode` applies on creation only) | add, keep (phase 2b) | `file-adapter` › on POSIX › rewrites an existing file to owner only | phase 2b: remove the `chmod` call => C7 red, C6 green |

### Current tests

| # | Current file › title | Behaviour it pins | Flags | Verdict | Target file › title | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `auth-login-use-case.unit` › authenticates with PAT when stored credential is provided at user level | the pass-through forwards a stored credential | U0 | delete with its code (the pass-through `auth-login-use-case.ts:12-14` disappears) | behaviour held by #9 and #10 | phase 6: `LogIn` saves without verifying => #9 red |
| 2 | `auth-login-use-case.unit` › authenticates with external credential at project level | forwards an external credential | U0 | delete with its code | held by #11 | phase 6: `LogIn` asks `gh` whatever the provider => #11 red |
| 3 | `auth-login-use-case.unit` › propagates error when provider fails | a provider failure rises | U0 | delete with its code | held by N17 (named provider refuses) | phase 6: `LogIn` catches the provider's error => N17 red |
| 4 | `auth-login-use-case.unit` › fails when stored credential has invalid token (HTTP 401) | a refused token rises | U0 | delete with its code | held by C1 | phase 6: `LogIn` catches the verifier's error => C1 red |
| 5 | `auth-logout-use-case.integration` › reports no auth file found when user is not logged in | nothing to remove | J | rewrite down | `log-out` › when nothing is stored › reports nothing found | |
| 6 | `auth-logout-use-case.integration` › removes project auth.json and returns project level | project record removed first, no hint | J | rewrite down | `log-out` › when a project record is stored › deletes it and reports the project level, with no hint | |
| 7 | `auth-logout-use-case.integration` › removes user auth.json when no project config found | user record removed | J | rewrite down | `log-out` › when only a user record is stored › deletes it and reports the user level | |
| 8 | `auth-logout-use-case.integration` › sets external-provider-cleanup hint when method=external | the hint | | rewrite down | `log-out` › when the record names an external provider › reports the external-provider-cleanup hint | |
| 9 | `auth-provider-adapter.unit` › logging in with a stored token › verifies the token it was given, not another | the token checked is the one handed | | rewrite | `log-in` › when a stored token is handed › verifies that token and reports its login at the level asked | |
| 10 | `auth-provider-adapter.unit` › logging in with a stored token › records the credential at the level asked for, against this project | save at the level asked | | rewrite | `log-in` › when a stored token is handed › saves it at the level asked | |
| 11 | `auth-provider-adapter.unit` › logging in through an external provider › asks the named provider, and returns the login it reports | provider lookup by name | | rewrite | `log-in` › when an external provider is named › asks that provider and reports its login | |
| 12 | `auth-provider-adapter.unit` › logging in through an external provider › names the provider it could not find | unknown provider error names it | | rewrite | `log-in` › when the named provider is not registered › throws an error naming it | |
| 13 | `auth-provider-adapter.unit` › with nothing recorded › says not authenticated, and verifies nothing | no record, no verification | | rewrite | `status` › when nothing is stored › reports not authenticated and verifies nothing | |
| 14 | `auth-provider-adapter.unit` › with a stored token recorded › verifies the recorded token and reports the recorded level | stored record verified | | rewrite | `status` › when a stored record is active › verifies its token and reports the login at the record's level | |
| 15 | `auth-provider-adapter.unit` › with a stored token recorded › refuses a record that claims a token and carries none | `invalid config` | | rewrite | `status` › when the active stored record carries no token › throws `AuthenticationError("invalid config")` | |
| 16 | `auth-provider-adapter.unit` › with an external record › asks the provider the record names | provider by record | | rewrite | `status` › when an external record is active › asks the provider it names | |
| 17 | `auth-provider-adapter.unit` › with an external record › falls back to gh when the record names no provider | `DEFAULT_PROVIDER` | | rewrite | `status` › when an external record names no provider › asks `gh` | |
| 18 | `auth-reader-branches.unit` › says where the token came from, and never the token | project stored, debug line | | rewrite, absorbs #31 | `provider` › the order of sources › (row) a stored project record answers its token and logs `Token resolved from project auth.json (stored)` | |
| 19 | `auth-reader-branches.unit` › names the user record when that one answered | user stored, debug line | | rewrite, absorbs #33 | `provider` › the order of sources › (row) a stored user record | |
| 20 | `auth-reader-branches.unit` › names the external provider when it answered | project external, debug line | | rewrite, absorbs #32 | `provider` › the order of sources › (row) an external project record | |
| 21 | `auth-reader-branches.unit` › says so when nothing answered | none, debug line | | rewrite, absorbs #35 | `provider` › the order of sources › (row) nothing answers null and logs `No token available` | |
| 22 | `auth-reader-branches.unit` › names the command line when the token came from it | explicit token, debug line | | rewrite | `provider` › the order of sources › (row) a command-line token alone | |
| 23 | `auth-reader-branches.unit` › falls past a stored record carrying no token | token stop rule | | rewrite | `sources` › when a record yields no token › falls past a stored record carrying none | |
| 24 | `auth-reader-branches.unit` › never asks the external provider for a stored record | method decides | | rewrite | `sources` › when a record yields no token › never asks the provider for a stored record | |
| 25 | `auth-reader-branches.unit` › asks the provider for an external record even when a stray token sits in it | method decides | | rewrite | `sources` › when a record yields no token › asks the provider for an external record even when a token sits in it | |
| 26 | `auth-reader-branches.unit` › falls past an external record when the provider has nothing | token stop rule | | rewrite | `sources` › when a record yields no token › falls past an external record the provider has nothing for | |
| 27 | `auth-reader-branches.unit` › answers nothing for an external record when no provider was wired | the default `noopExternalProvider` | | delete with the default | none | behaviour deleted with its code: no product caller omits the provider (`framework.ts:222-228`) |
| 28 | `auth-reader.integration` › a token given on the command line › comes before AIDD_TOKEN and before anything stored | explicit first | | rewrite | `provider` › the order of sources › (row) the command line wins over `AIDD_TOKEN` and a stored record | |
| 29 | `auth-reader.integration` › is not consulted when none was given, so AIDD_TOKEN keeps its place | env second | | rewrite | `provider` › the order of sources › (row) `AIDD_TOKEN` answers when no command line was given, and logs `Token resolved from AIDD_TOKEN env` | |
| 30 | `auth-reader.integration` › AIDD_TOKEN env var › returns env token immediately | env answers | | delete | held by #29 | phase 6: drop the `AIDD_TOKEN` branch => #29 red |
| 31 | `auth-reader.integration` › project auth.json › returns stored token when method=stored | project stored | | merge into #18 | `provider` row of #18 | phase 6: same assertion in the row; break => #18 row red |
| 32 | `auth-reader.integration` › project auth.json › returns external token when method=external | project external | D, J | merge into #20 | `provider` row of #20 | same |
| 33 | `auth-reader.integration` › user auth.json › returns stored token when method=stored and no project config | user stored | J | merge into #19 | `provider` row of #19 | same |
| 34 | `auth-reader.integration` › user auth.json › returns external token when method=external | user external | D | rewrite | `provider` › the order of sources › (row) an external user record | |
| 35 | `auth-reader.integration` › null fallback › returns null when no token source is available | none | D | merge into #21 | `provider` row of #21 | same |
| 36 | `auth-reader.integration` › resolveContext › returns null when no token is available | `resolveContext` | J | delete with the method | none | method deleted: no caller (`grep -rn resolveContext src`) |
| 37 | `auth-reader.integration` › resolveContext › returns defaults method=stored and level=user when no config exists | same | | delete with the method | none | same |
| 38 | `auth-reader.integration` › resolveContext › reads method and level from project config | same | J | delete with the method | none | same |
| 39 | `auth-reader.integration` › resolveContext › falls back to user config when no project config | same | J | delete with the method | none | same |
| 40 | `auth-reader.integration` › memoization › calls storage read only once across multiple resolve() calls | memoization, `gh` spawned once | | rewrite | `provider` › when asked several times › reads each record once | |
| 41 | `auth-reader.integration` › logging › logs resolution source without revealing token value | no token in any log line | | rewrite, kept separate (a negative assertion over every logger call, not one exact line) | `provider` › logging › never logs the token, whatever the source | phase 6: add a debug call that logs the token => this test red |
| 42 | `auth-status-use-case.unit` › returns authenticated status when provider resolves a valid login | the pass-through forwards | U0 | delete with its code (`auth-status-use-case.ts:6-8`) | held by #14 | phase 6: `CheckStatus` answers not authenticated => #14 red |
| 43 | `auth-status-use-case.unit` › returns unauthenticated status when no credentials stored | forwards | U0 | delete with its code | held by #13 | phase 6: `CheckStatus` answers authenticated => #13 red |
| 44-51 | `auth-storage-shape.integration` › reads %s as no record at all (8: null, a string, a number, an array, another version, an unknown method, an unknown level, no createdAt) | the record invariants | U0 | rewrite down | `record` › parsing a stored record › reads %s as no record (the same 8) | |
| 52 | `auth-storage-shape.integration` › reads back exactly what it wrote, pretty-printed | pretty-print through `write` | U0 | merge into C5 | `file-adapter` › writing a record › writes these exact bytes | phase 8: indent 4 => C5 red |
| 53 | `auth-storage-shape.integration` › records an external credential with its provider and no token | external shape | U0, J | rewrite | `repo-contract` › an external credential is kept with its provider and no token | |
| 54 | `auth-storage-shape.integration` › records a stored credential with its token and no provider | stored shape | U0, J | rewrite | `repo-contract` › a stored credential is kept with its token and no provider | |
| 55 | `auth-storage-shape.integration` › synthesises a stored user-level record from AIDD_TOKEN | status under `AIDD_TOKEN` | U0 | rewrite | `sources` › the active credential › with `AIDD_TOKEN` set, is a stored user credential carrying it | |
| 56 | `auth-storage-shape.integration` › refuses to grant an empty Windows account | empty `USERNAME` refused, exact message | U0 | rewrite, with #65 | `file-adapter` › on win32 › refuses an account that is %s (empty, unset) | |
| 57 | `auth-storage.integration` › read › returns null when file does not exist | absent reads null | | rewrite | `repo-contract` › nothing stored at a level reads as null | |
| 58 | `auth-storage.integration` › read › returns null when file contains invalid JSON | unreadable reads null | | rewrite (SF10: the port cannot drive it) | `file-adapter` › reading a record › reads an unreadable file as no record | |
| 59 | `auth-storage.integration` › read › returns null when file contains JSON missing required fields | the read goes through the parse | | rewrite (SF10) | `file-adapter` › reading a record › reads a file the parse refuses as no record (the shapes themselves: `record`, #44-51) | |
| 60 | `auth-storage.integration` › read › returns AuthConfig when file is valid | round trip | | rewrite, with #76 and #77 | `repo-contract` › a saved credential reads back at its level (project, user) | |
| 61 | `auth-storage.integration` › write › creates parent directories and writes the file | parents created | | rewrite | `file-adapter` › writing a record › creates the missing parent directories | |
| 62 | `auth-storage.integration` › write › sets restrictive file permissions on non-Windows | `0600` | | keep, retitled | `file-adapter` › on POSIX › leaves the file readable by its owner only | |
| 63 | `auth-storage.integration` › write › restricts the file on win32 through an icacls argument list | `icacls` arguments | | keep, retitled | `file-adapter` › on win32 › restricts the file through an icacls argument list | |
| 64 | `auth-storage.integration` › write › names the account from the environment | `USERNAME` read | | keep | `file-adapter` › on win32 › names the account from the environment | |
| 65 | `auth-storage.integration` › write › refuses to leave inheritance stripped with no grant when the session names no account | unset `USERNAME` refused | | rewrite, with #56 | `file-adapter` › on win32 › refuses an account that is %s | |
| 66 | `auth-storage.integration` › write › passes a path carrying shell metacharacters as one verbatim argument | no shell | | keep | `file-adapter` › on win32 › passes a path with shell metacharacters as one argument | |
| 67 | `auth-storage.integration` › write › written file can be read back | round trip | | delete | held by #60 | phase 8: write empty JSON => #60 red |
| 68 | `auth-storage.integration` › delete › removes an existing file | delete | | rewrite | `repo-contract` › deleting a level removes its record and leaves the other | |
| 69 | `auth-storage.integration` › delete › does not throw when file does not exist | delete of nothing | | rewrite | `repo-contract` › deleting a level that holds nothing does not throw | |
| 70 | `auth-storage.integration` › paths › projectConfigPath returns .aidd/auth.json under projectRoot | project layout | | rewrite | `file-adapter` › where records live › keeps the project record at `<root>/.aidd/auth.json` | |
| 71 | `auth-storage.integration` › paths › userConfigPath respects AIDD_USER_CONFIG_DIR env override (phase 3: writes the user record under the directory it was given) | user layout | | rewrite | `file-adapter` › where records live › keeps the user record at `<user config dir>/auth.json` | |
| 72 | `auth-storage.integration` › readActive › returns AIDD_TOKEN env config when env var is set | env synthesis | | delete | held by #55 | phase 6: drop the env synthesis => #55 red |
| 73 | `auth-storage.integration` › readActive › returns project config when no AIDD_TOKEN env var but project auth.json exists | active: project | | rewrite | `sources` › the active credential › is the project record when one exists | |
| 74 | `auth-storage.integration` › readActive › returns user config when no AIDD_TOKEN and no project auth.json | active: user | | rewrite | `sources` › the active credential › is the user record when no project record exists | |
| 75 | `auth-storage.integration` › readActive › returns null when no token source is available | active: none | D | rewrite | `sources` › the active credential › is nothing when nothing is stored | |
| 76 | `auth-storage.integration` › save › saves project-level credential to .aidd/auth.json | save at project | | merge into #60 | `repo-contract` row project of #60 | phase 8: save always at user => #60 project row red |
| 77 | `auth-storage.integration` › save › saves user-level credential to user config path | save at user | | merge into #60 | `repo-contract` row user of #60 | phase 8: save always at project => #60 user row red |
| 78 | `auth-storage.integration` › save › saves external credential without token field | external shape | | delete | held by #53 | phase 8: write `token` for an external credential => #53 red |
| 79 | `gh-cli-adapter.integration` › returns the token when gh auth token succeeds | trimmed token | | keep | `gh-adapter` › resolving a token › answers the token gh prints, trimmed | |
| 80 | `gh-cli-adapter.integration` › returns null when gh is not installed (ENOENT) | absent is null | | keep | `gh-adapter` › resolving a token › answers null when gh is absent | |
| 81 | `gh-cli-adapter.integration` › returns null when gh auth token exits 0 with empty output | empty is null | | keep | `gh-adapter` › resolving a token › answers null when gh prints nothing | |
| 82 | `gh-cli-adapter.integration` › throws with stderr when gh auth token exits non-zero | stderr named | | delete | held by #93 | phase 8: drop the stderr from the message => #93 red |
| 83 | `gh-cli-adapter.integration` › throws with exit code when gh auth token exits non-zero with no stderr | code named | | keep | `gh-adapter` › when gh fails › names the exit code when gh wrote nothing | |
| 84 | `gh-cli-adapter.integration` › throws an upgrade hint when gh is too old | upgrade hint | | keep | `gh-adapter` › when gh fails › names the upgrade when gh lacks `auth token` | |
| 85 | `gh-cli-verify.integration` › the commands it runs › reads the token through `gh auth token`, with a bounded wait | arguments, 3 s | | keep | `gh-adapter` › the commands it runs › reads the token through `gh auth token` within 3 s | |
| 86 | `gh-cli-verify.integration` › the commands it runs › names the login through `gh api user`, with a bounded wait | arguments, 5 s | | keep | `gh-adapter` › the commands it runs › reads the login through `gh api user` within 5 s | |
| 87 | `gh-cli-verify.integration` › verify › answers the login gh prints, trimmed | trimmed login | | keep | `gh-adapter` › verifying › answers the login gh prints, trimmed | |
| 88 | `gh-cli-verify.integration` › verify › refuses when gh is not installed | absent refused | | keep | `gh-adapter` › verifying › refuses when gh is absent | |
| 89 | `gh-cli-verify.integration` › verify › refuses when gh exits non-zero | failure refused | | keep | `gh-adapter` › verifying › refuses when gh fails | |
| 90 | `gh-cli-verify.integration` › verify › refuses an empty login | empty refused | | keep | `gh-adapter` › verifying › refuses an empty login | |
| 91 | `gh-cli-verify.integration` › resolve, reading stderr › copes with gh answering no stderr stream at all | undefined stderr | | keep | `gh-adapter` › when gh fails › copes with no stderr stream | |
| 92 | `gh-cli-verify.integration` › resolve, reading stderr › says the exit code is unknown when gh left none | `unknown` code | | keep | `gh-adapter` › when gh fails › says the code is unknown when gh left none | |
| 93 | `gh-cli-verify.integration` › resolve, reading stderr › trims the stderr it reports | stderr trimmed | | keep | `gh-adapter` › when gh fails › names its stderr, trimmed | |
| 94 | `gh-token-adapter.unit` › asks GitHub who the token belongs to, with the token | `/user`, default base, token only | | keep (moved by foundations; outside the auth set, 121 tests) | `github` › same title | |
| 95 | `gh-token-adapter.unit` › refuses an answer carrying no login | no login refused | | keep | `github` › same | |
| 96-103 | `gh-token-adapter.unit` › refuses a malformed user response: %s (8) | body validation | | keep | `github` › same | |
| 104-109 | `gh-token-adapter.unit` › refuses HTTP %i even when the response carries a login (6) | status validation | | keep | `github` › same | |
| 110 | `gh-token-adapter.unit` › reports a rejected request without exposing its token or underlying error | no leak | | keep | `github` › same | |
| 111 | `presentation/commands/auth-wiring.integration` › aidd auth login, the credential it stores › stores the token it was handed, at the level it was told | flags to command | | keep, mock follows | same file › same title, em dash removed from the `describe` | |
| 112 | same › records a gh-resolved credential as external, storing no token of its own | `--gh` | | keep | same | |
| 113 | same, what it asks a person at a terminal › offers both storage levels, naming where each one lands | level prompt | | keep | same | |
| 114 | same › falls back to gh when the person has no token of their own | confirm prompt | | keep | same | |
| 115 | same › stores the token the person pasted | input prompt | | keep | same | |
| 116 | same › refuses an empty paste rather than storing a credential of nothing | empty input | | keep | same | |
| 117 | same, what it refuses before building anything › refuses a run that names two ways of authenticating at once | `--gh` with `--token` | | keep | same | |
| 118 | same › refuses to prompt for a credential off a terminal | non-TTY credential | | keep | same | |
| 119 | same › refuses to prompt for a storage level off a terminal | non-TTY level | | keep | same | |
| 120 | same › refuses a level that is neither user nor project | level validation | | keep | same | |
| 121 | aidd auth logout › says nothing was stored when there was nothing to remove | logout display | | keep | same | |
| 122 | aidd auth logout › names the level it cleared, and the external command still to run | logout hint display | | keep | same | |
| 123 | aidd auth logout, a store that refuses › names the failure on stderr and fails the process | error edge | | keep | same | |
| 124 | aidd auth status › says so when nothing authenticates this machine | status display | | keep | same | |
| 125 | aidd auth status › names who is authenticated and at which level | status display | | keep | same | |
| 126-128 | aidd auth, how every subcommand builds its graph › hands %j this run's verbosity, never an empty option set (3) | `createDeps` options | | keep | same | |
| 129 | same › names a failed status read on stderr and fails the process | error edge | | keep | same | |
| 130 | aidd auth, the help surface › describes the group and every subcommand, in the order they are registered | help text, frozen | | keep | same | |
| 131 | same › offers login three ways of being told, and asks nothing of logout or status | flags, frozen | | keep | same | |
| 132 | same › prints its own help when the group is run with no subcommand | bare group | | keep | same | |
| 133 | `presentation/display/auth-display.unit` › printAuthenticated › names the login and the level it was stored at | display | | keep | same | |
| 134 | same › printAuthStatus › says not authenticated when no credential resolved | display | | keep | same | |
| 135 | same › printAuthStatus › names the login and its level when one resolved | display | | keep | same | |
| 136 | same › printLogoutResult › says not authenticated when there was nothing to remove | display | | keep | same | |
| 137 | same › printLogoutResult › confirms the level a stored credential was removed from | display | | keep | same | |
| 138 | same › printLogoutResult › points at the external provider's own logout before confirming | display | | keep | same | |

### New tests, phases 6 and 8

| # | Target file › title | Why it is not redundant | Proof |
| --- | --- | --- | --- |
| N1 | `record` › parsing a stored record › reads a valid record as itself | the positive case of the parse table, now that the parse is a domain function | seen red against a parse that answers null |
| N2 | `sources` › the two stop rules › the token comes from the user record while the active credential is the tokenless project record | C3 rewritten across both queries: the divergence D4 keeps | seen red against one shared stop rule |
| N3 | `log-out` › when the record names a level other than its file's › reports the level the record names | the record's own level is reported (`auth-provider-adapter.ts:44,52`); kept as a limit | seen red against reporting the file's level |
| N4 to N9 | `repo-contract`: the cases of #53, #54, #57, #60, #68, #69 run on the fake as well (the fake keeps records, not text: SF10) | the fake is new, and only the suite proves it tells the truth | each seen red on a fake broken for it |
| N10 to N12 | `ports/identity-verifier.contract.test.ts`: known token answers its login; refused token throws `AuthenticationError("GitHub API")`; the refusal never carries the token. Fake and `GitHubAdapter` behind a local server | no test ran `GitHubAdapter` through the real `HttpClient` | seen red on each arm |
| N13 to N16 | `ports/cli-auth-provider.contract.test.ts`: a token answers it; absent answers null; a failure throws; `verify` answers a login or refuses. Fake everywhere, `GhCliAdapter` on a fake `gh` on POSIX | no test ran the real `spawnSync` against an executable | seen red on each arm |
| N17 | `log-in` › when the named provider refuses › throws and saves nothing | SF4: the external twin of C1; nothing pins it today | seen red against a `LogIn` that saves before asking the provider |
| N18 | `record` › removal hint, provider and stored token › answers the cleanup hint for an external record only; answers `gh` for a record naming no provider; throws `invalid config` for a stored record without token | SF5: the three rules move from `auth-provider-adapter.ts:59-61,71-73` into the aggregate | seen red against each function returning its opposite |

Planned counts, revised by phase 11: 138 rows, of which #94 to #110 (17) left the auth set with foundations, so the auth set holds 121; 63 kept (#62 to #64, #66, #79 to #81, #83 to #138; 46 of them in the auth set); 52 rewritten; 7 merged into another row (#31, #32, #33, #35, #52, #76, #77); 16 deleted: 11 with their code (#1 to #4, #27, #36 to #39, #42, #43), each with the test now holding the behaviour named, and 5 by inverted proof (#30, #67, #72, #78, #82); 8 characterization (C1, C2, C3, C4b, C4c, C4d, C5, C6) and about 18 new (N1 to N18).

## Appendix B: after measures

Filled in phase 11, one row per line of "Before and after", with the command output that gives it.
