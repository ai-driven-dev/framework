---
objective: "Every source file under cli/src is held to six size limits by Biome at error level, today's violators sit in a baseline that can only shrink, each limit is proven to bite on a planted tree, and the rules state these limits once, with no product behaviour changed."
status: pending
---

# Plan: PR 2 of stage A, code size rules

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Function length, cognitive complexity, one class per file, file length, function parameters and constructor parameters, enforced by Biome on `cli/src/**`, with a shrink-only baseline held by one architecture test and one planted tree. |
| **Source** | Text contract (PR 2 of stage A, as amended for parameters), grounded in `target/00-overview.md` sections 5, 7, 11, 15 and `target/08-guardrails-and-repo-map.md` sections 2.3, 2.4, 7, 9, read from the `test/test-levels-and-guards` branch. |

The six limits, all at `error`, all scoped to `src/**`:

| Guard | Carrier | Limit |
| --- | --- | --- |
| Function length | `complexity/noExcessiveLinesPerFunction` | `maxLines: 50`, `skipBlankLines: true` |
| Cognitive complexity | `complexity/noExcessiveCognitiveComplexity` | `maxAllowedComplexity: 15` |
| One class per file | `style/noExcessiveClassesPerFile` | `maxClasses: 1` |
| File length | `style/noExcessiveLinesPerFile` | `maxLines: 400`, `skipBlankLines: true` |
| Function and method parameters | GritQL plugin `biome-plugins/max-function-params.grit` | at most 3; beyond that, a named object |
| Constructor parameters | GritQL plugin `biome-plugins/max-constructor-params.grit` | at most 5 (overview section 7) |

`complexity/useMaxParams` is not enabled (decision D2).

Out of scope, left to later PRs: refactoring any violator, any rule on `tests/**`, e2e policy, mutation, the cap of 4 in `0-orchestration.md` and the fate of `orchestrator-deps.arch.test.ts` (decision D7).

Every path below is relative to the repository root unless it starts inside a `cd cli` command. `$B` is the baseline directory created in phase 1: `B="${TMPDIR:-/tmp}/aidd-pr2-baseline"`. Nothing is committed.

Merge order: PR 1 (`test/test-levels-and-guards`) edits `cli/biome.json` (a `tests/**/*.unit.test.ts` override before the final `noDefaultExport` override) and `cli/tests/architecture/biome-guards-bite.arch.test.ts`. This PR edits both too. Whichever merges second rebases; the conflicts are textual (two overrides inserted at the same place, one helper moved out of a file PR 1 appends to), and the rebased branch reruns phase 4.

## Phases

| #   | Phase | Model | Depends on |
| --- | ----- | ----- | ---------- |
| 1   | Baseline capture | haiku | none |
| 2   | Guards, baseline and planted proof | sonnet | 1 |
| 3   | Rules and memory | sonnet | 2 |
| 4   | Gates and final acceptance | haiku | 3 |

### Phase 1: Baseline capture (haiku)

> Measure today's violators of the six guards on an isolated copy of `src`, so the baseline written in phase 2 is exactly what Biome reports.

Files touched: none in the tree. Writes only to `$B`.

Tasks:

1. Confirm the tree is clean apart from the task folder: `git status --porcelain` lists nothing outside `aidd_docs/tasks/2026_11/`.
2. Build the isolated measurement tree:

```sh
B="${TMPDIR:-/tmp}/aidd-pr2-baseline"; rm -rf "$B"; mkdir -p "$B/biome-plugins"
cp -R cli/src "$B/src"
cat > "$B/biome-plugins/max-function-params.grit" <<'EOF'
language js

// A function, method, arrow, callback or signature with more than three parameters.
// Constructors are JsConstructorParameters, not JsParameters, and have their own limit.
JsParameters(items=$items) as $params where {
  $items <: [$a, $b, $c, $d, ...],
  register_diagnostic(span=$params, message="A function takes at most 3 parameters: pass a named object instead (cli/.claude/rules/00-architecture/0-code-size.md)", severity="error")
}
EOF
cat > "$B/biome-plugins/max-constructor-params.grit" <<'EOF'
language js

// A constructor injecting more than five dependencies does too much (overview section 7).
JsConstructorParameters(parameters=$items) as $params where {
  $items <: [$a, $b, $c, $d, $e, $f, ...],
  register_diagnostic(span=$params, message="A constructor takes at most 5 dependencies: past that the class does too much, split it (cli/.claude/rules/00-architecture/0-code-size.md)", severity="error")
}
EOF
cat > "$B/biome.json" <<'EOF'
{
  "vcs": { "enabled": false },
  "formatter": { "enabled": false },
  "assist": { "enabled": false },
  "plugins": ["./biome-plugins/max-function-params.grit", "./biome-plugins/max-constructor-params.grit"],
  "linter": {
    "rules": {
      "recommended": false,
      "complexity": {
        "noExcessiveLinesPerFunction": { "level": "error", "options": { "maxLines": 50, "skipBlankLines": true } },
        "noExcessiveCognitiveComplexity": { "level": "error", "options": { "maxAllowedComplexity": 15 } }
      },
      "style": {
        "noExcessiveClassesPerFile": { "level": "error", "options": { "maxClasses": 1 } },
        "noExcessiveLinesPerFile": { "level": "error", "options": { "maxLines": 400, "skipBlankLines": true } }
      }
    }
  }
}
EOF
BIOME="$PWD/cli/node_modules/.bin/biome"
(cd "$B" && "$BIOME" lint --reporter=github --max-diagnostics=none src > out.txt 2>&1)
```

3. Split the findings per guard and count them:

```sh
cd "$B"
f() { grep "$1" out.txt | sed -E 's#.*file=([^,]+),.*#\1#; s#.*/aidd-pr2-baseline/##' | sort -u > "$2.list"; echo "$2 $(grep -c "$1" out.txt) $(wc -l < "$2.list" | tr -d ' ')"; }
f 'noExcessiveLinesPerFunction,' lines-per-function
f 'noExcessiveCognitiveComplexity,' cognitive-complexity
f 'noExcessiveClassesPerFile,' classes-per-file
f 'noExcessiveLinesPerFile,' lines-per-file
f 'at most 3 parameters' function-params
f 'at most 5 dependencies' constructor-params
```

4. Prove the starting point is green: `cd cli && pnpm lint && pnpm test:arch`.

Acceptance:

| Command | Expected |
| --- | --- |
| Task 3 | exactly these six lines: `lines-per-function 28 20`, `cognitive-complexity 43 32`, `classes-per-file 9 9`, `lines-per-file 9 9`, `function-params 204 93`, `constructor-params 21 21` (guard, diagnostics, files) |
| Check A below, from the repository root | no output |
| `cat "$B"/*.list \| sort -u \| wc -l` | `136` distinct files |
| `cd cli && pnpm lint && pnpm test:arch` | exit 0 |

```sh
# Check A: each measured list equals the list this plan records for its guard
P=aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-pr2-code-size-rules.md
x() { awk -v h="$1" 'index($0, h) == 1 { f = 1; next } f && /^```txt/ { g = 1; next } g && /^```/ { exit } g' "$P"; }
diff <(x '#### `noExcessiveLinesPerFunction`') "$B/lines-per-function.list"
diff <(x '#### `noExcessiveCognitiveComplexity`') "$B/cognitive-complexity.list"
diff <(x '#### `noExcessiveClassesPerFile`') "$B/classes-per-file.list"
diff <(x '#### `noExcessiveLinesPerFile`') "$B/lines-per-file.list"
diff <(x '#### Function parameters') "$B/function-params.list"
diff <(x '#### Constructor parameters') "$B/constructor-params.list"
```

If a count differs, the tree moved since this plan was measured: take the measured lists as the baseline and record the new counts in the PR description. Never edit a violator to make the numbers match.

The baseline measured on this branch, one list per guard (diagnostics, files):

#### `noExcessiveLinesPerFunction`: function length, more than 50 non-blank lines (28, 20)

```txt
src/contexts/framework/application/clean-use-case.ts
src/contexts/framework/application/clean/clean-user-scope-use-case.ts
src/contexts/framework/application/flows/marketplace-sync-settings-use-case.ts
src/contexts/framework/application/framework/translator/built-tree-materialization-translator.ts
src/contexts/framework/application/ownership/user-marketplace-remove-use-case.ts
src/contexts/framework/application/ownership/user-plugin-update-use-case.ts
src/contexts/framework/application/plugin/plugin-remove-use-case.ts
src/contexts/framework/domain/recipes/recipe-validation.ts
src/contexts/telemetry/application/ingest-usage-use-case.ts
src/contexts/telemetry/domain/formats/claude-transcript-usage.ts
src/contexts/telemetry/domain/formats/codex-transcript-usage.ts
src/contexts/tools/domain/capabilities/plugins-capability.ts
src/presentation/commands/auth.ts
src/presentation/commands/framework.ts
src/presentation/commands/marketplace.ts
src/presentation/commands/plugin.ts
src/presentation/commands/setup.ts
src/presentation/commands/telemetry.ts
src/runtime/wiring/framework.ts
src/runtime/wiring/telemetry.ts
```

#### `noExcessiveCognitiveComplexity`: cognitive complexity over 15 (43, 32)

```txt
src/contexts/framework/application/clean-use-case.ts
src/contexts/framework/application/clean/clean-user-scope-use-case.ts
src/contexts/framework/application/doctor/doctor-registration-use-case.ts
src/contexts/framework/application/flows/marketplace-sync-settings-use-case.ts
src/contexts/framework/application/ownership/global-plugin-files.ts
src/contexts/framework/application/ownership/user-plugin-update-use-case.ts
src/contexts/framework/application/plugin/plugin-add-use-case.ts
src/contexts/framework/application/plugin/plugin-remove-use-case.ts
src/contexts/framework/application/recipes/validate-recipes-use-case.ts
src/contexts/framework/application/setup/install-global-plugins-use-case.ts
src/contexts/framework/application/shared/remove-project-hooks.ts
src/contexts/framework/application/shared/user-scope-plugin-files.ts
src/contexts/framework/domain/config-capability.ts
src/contexts/framework/domain/manifest.ts
src/contexts/framework/domain/marketplace-source-drift.ts
src/contexts/framework/domain/recipes/recipe-validation.ts
src/contexts/framework/domain/setup-flow.ts
src/contexts/framework/infrastructure/plugin-distribution-reader-adapter.ts
src/contexts/telemetry/application/ingest-usage-use-case.ts
src/contexts/telemetry/domain/formats/codex-transcript-usage.ts
src/contexts/telemetry/domain/report/period.ts
src/contexts/telemetry/domain/switch/legacy-config.ts
src/contexts/telemetry/infrastructure/usage-ledger-adapter.ts
src/contexts/tools/domain/capabilities/plugins-capability.ts
src/contexts/tools/domain/profiles/copilot/profile.ts
src/kernel/markdown.ts
src/kernel/reading/jsonc.ts
src/kernel/source.ts
src/presentation/commands/auth.ts
src/presentation/display/telemetry-display.ts
src/presentation/display/telemetry/telemetry-lifecycle-display.ts
src/presentation/display/telemetry/telemetry-report-display.ts
```

#### `noExcessiveClassesPerFile`: more than one class per file (9, 9)

```txt
src/contexts/framework/application/global/resolve-update-decision-use-case.ts
src/contexts/telemetry/application/directory-resolver.ts
src/contexts/telemetry/infrastructure/ledger-lock.ts
src/contexts/telemetry/infrastructure/transcripts/codex-transcript-source-adapter.ts
src/contexts/tools/infrastructure/host-plugin-registry-reader-adapter.ts
src/contexts/tools/infrastructure/native-marketplace-source-reader-adapter.ts
src/kernel/errors.ts
src/kernel/file.ts
src/runtime/prompter/prompter-adapter.ts
```

#### `noExcessiveLinesPerFile`: file length, more than 400 non-blank lines (9, 9)

```txt
src/contexts/framework/application/clean-use-case.ts
src/contexts/framework/application/clean/clean-user-scope-use-case.ts
src/contexts/framework/application/flows/marketplace-sync-settings-use-case.ts
src/contexts/framework/application/plugin/plugin-add-use-case.ts
src/contexts/framework/application/plugin/plugin-remove-use-case.ts
src/contexts/framework/domain/recipes/recipe-validation.ts
src/contexts/translate/domain/content-translator.ts
src/kernel/errors.ts
src/runtime/wiring/framework.ts
```

#### Function parameters: function or method with more than 3 parameters, `max-function-params.grit` (204, 93)

```txt
src/contexts/distribution/application/fetch-marketplace-source-use-case.ts
src/contexts/distribution/domain/ports/marketplace-registry.ts
src/contexts/distribution/infrastructure/marketplace-registry-adapter.ts
src/contexts/distribution/infrastructure/plugin-fetcher-adapter.ts
src/contexts/framework/application/clean-use-case.ts
src/contexts/framework/application/doctor/doctor-use-case.ts
src/contexts/framework/application/flows/marketplace-sync-settings-use-case.ts
src/contexts/framework/application/framework/translator/built-tree-materialization-translator.ts
src/contexts/framework/application/framework/translator/flat-mcp-materializer.ts
src/contexts/framework/application/framework/translator/mode-a-marketplace-translator.ts
src/contexts/framework/application/framework/translator/mode-b-flat-materialization-translator.ts
src/contexts/framework/application/framework/translator/plugin-translator.ts
src/contexts/framework/application/framework/translator/project-hooks-materializer.ts
src/contexts/framework/application/global/restore-all-use-case.ts
src/contexts/framework/application/global/update-one-tool-use-case.ts
src/contexts/framework/application/global/update-tools-use-case.ts
src/contexts/framework/application/install/content/install-content-section-use-case.ts
src/contexts/framework/application/install/install-ai-tool-use-case.ts
src/contexts/framework/application/install/install-config-use-case.ts
src/contexts/framework/application/install/install-ide-tool-use-case.ts
src/contexts/framework/application/install/install-runtime-config-use-case.ts
src/contexts/framework/application/ownership/global-plugin-files.ts
src/contexts/framework/application/ownership/native-host-registration-gate.ts
src/contexts/framework/application/ownership/native-marketplace-source-proof.ts
src/contexts/framework/application/ownership/native-plugin-ownership.ts
src/contexts/framework/application/ownership/project-plugin-cleanup.ts
src/contexts/framework/application/ownership/user-plugin-file-updater.ts
src/contexts/framework/application/ownership/user-plugin-ownership.ts
src/contexts/framework/application/plugin/plugin-add-use-case.ts
src/contexts/framework/application/plugin/plugin-helpers.ts
src/contexts/framework/application/plugin/plugin-remove-use-case.ts
src/contexts/framework/application/plugin/plugin-target-resolution.ts
src/contexts/framework/application/plugin/plugin-update-use-case.ts
src/contexts/framework/application/restore/generate-tool-distribution-use-case.ts
src/contexts/framework/application/restore/restore-all-plugins-use-case.ts
src/contexts/framework/application/restore/restore-merge-files-use-case.ts
src/contexts/framework/application/restore/restore-regular-files-use-case.ts
src/contexts/framework/application/restore/restore-use-case.ts
src/contexts/framework/application/setup-use-case.ts
src/contexts/framework/application/shared/ensure-built-marketplace-use-case.ts
src/contexts/framework/application/shared/host-marketplace-source-conflict.ts
src/contexts/framework/application/shared/purge-declared-cache.ts
src/contexts/framework/application/shared/purge-native-marketplace-cache.ts
src/contexts/framework/application/shared/remove-project-hooks.ts
src/contexts/framework/application/shared/resolve-uninstall-scope.ts
src/contexts/framework/application/shared/user-scope-plugin-files.ts
src/contexts/framework/application/status-use-case.ts
src/contexts/framework/application/uninstall/uninstall-plugin-use-case.ts
src/contexts/framework/application/uninstall/uninstall-tools-use-case.ts
src/contexts/framework/domain/installed-rule.ts
src/contexts/framework/domain/manifest.ts
src/contexts/framework/domain/plugins/installed-plugin.ts
src/contexts/framework/domain/recipes/recipe-validation.ts
src/contexts/framework/domain/setup-flow.ts
src/contexts/telemetry/application/directory-resolver.ts
src/contexts/telemetry/application/switch/remember-own-root.ts
src/contexts/telemetry/domain/branch-binding.ts
src/contexts/telemetry/domain/declaration/binding-resolution.ts
src/contexts/telemetry/domain/formats/line-values.ts
src/contexts/telemetry/domain/legacy/legacy-locations.ts
src/contexts/telemetry/domain/ports/transcript-source.ts
src/contexts/telemetry/domain/report/report-filter.ts
src/contexts/telemetry/domain/report/usage-report.ts
src/contexts/telemetry/infrastructure/claude-transcript-source-adapter.ts
src/contexts/telemetry/infrastructure/declaration/git-branch-binding-store-adapter.ts
src/contexts/telemetry/infrastructure/transcripts/codex-transcript-source-adapter.ts
src/contexts/telemetry/infrastructure/transcripts/transcript-files.ts
src/contexts/tools/domain/build-contract.ts
src/contexts/tools/domain/formats/opencode-mcp-merge.ts
src/contexts/tools/domain/formats/vscode-mcp-merge.ts
src/contexts/tools/domain/host-plugin-registration.ts
src/contexts/tools/domain/marketplace-catalog.ts
src/contexts/tools/domain/marketplace-source-conflict.ts
src/contexts/tools/domain/profiles/claude/build.ts
src/contexts/tools/domain/profiles/codex/build.ts
src/contexts/tools/domain/profiles/copilot/build.ts
src/contexts/tools/domain/profiles/cursor/build.ts
src/contexts/tools/domain/profiles/kilo/build.ts
src/contexts/tools/domain/profiles/opencode/build.ts
src/contexts/translate/application/strategies/flat-build-strategy.ts
src/contexts/translate/application/strategies/write-skill-tree.ts
src/contexts/translate/domain/content-translator.ts
src/kernel/materialization/flat-paths.ts
src/kernel/paths.ts
src/presentation/commands/clean.ts
src/presentation/commands/doctor.ts
src/presentation/commands/framework.ts
src/presentation/commands/sync-native-activation.ts
src/presentation/commands/sync.ts
src/presentation/commands/telemetry.ts
src/presentation/display/doctor-display.ts
src/presentation/display/framework-display.ts
src/presentation/prompts/sync-conflict-resolver-use-case.ts
```

#### Constructor parameters: constructor with more than 5 parameters, `max-constructor-params.grit` (21, 21)

```txt
src/contexts/framework/application/clean-use-case.ts
src/contexts/framework/application/clean/clean-user-scope-use-case.ts
src/contexts/framework/application/doctor/doctor-registration-use-case.ts
src/contexts/framework/application/doctor/doctor-use-case.ts
src/contexts/framework/application/flows/marketplace-sync-settings-use-case.ts
src/contexts/framework/application/install/install-ide-tool-use-case.ts
src/contexts/framework/application/plugin/plugin-add-use-case.ts
src/contexts/framework/application/plugin/plugin-install-use-case.ts
src/contexts/framework/application/plugin/plugin-remove-use-case.ts
src/contexts/framework/application/plugin/plugin-update-use-case.ts
src/contexts/framework/application/restore/restore-tool-files-use-case.ts
src/contexts/framework/application/restore/restore-use-case.ts
src/contexts/framework/application/setup-use-case.ts
src/contexts/framework/application/shared/setup-marketplace-registration-use-case.ts
src/contexts/telemetry/application/directory-resolver.ts
src/contexts/telemetry/application/forget/forget-telemetry-use-case.ts
src/contexts/telemetry/application/ingest-usage-use-case.ts
src/contexts/telemetry/application/report/report-usage-use-case.ts
src/contexts/telemetry/application/switch/telemetry-off-use-case.ts
src/contexts/telemetry/application/switch/telemetry-on-use-case.ts
src/contexts/translate/application/strategies/flat-build-strategy.ts
```

### Phase 2: Guards, baseline and planted proof (sonnet)

> Six carrier overrides in `cli/biome.json`, each excluding exactly its baseline files; one architecture test proves the baseline only shrinks and that each guard bites.

Architecture projection:

```txt
cli/
├── biome.json                                          ✏️ six carrier overrides on src/**, baseline as negated includes
├── biome-plugins/
│   ├── max-function-params.grit                        ✅ more than 3 parameters, outside constructors
│   └── max-constructor-params.grit                     ✅ more than 5 constructor parameters
└── tests/architecture/
    ├── helpers.ts                                      ✏️ receives BIOME, reportedFile, biomeFindings
    ├── biome-guards-bite.arch.test.ts                  ✏️ imports them from helpers.ts, no behaviour change
    └── code-size.arch.test.ts                          ✅ carrier pins, shrink-only ratchet, planted tree
```

Tasks:

1. Move `BIOME`, `reportedFile` and `biomeFindings` from `biome-guards-bite.arch.test.ts:14-47` to `helpers.ts`, exported, unchanged. `biome-guards-bite.arch.test.ts` imports them. Run `cd cli && pnpm exec vitest run tests/architecture/biome-guards-bite.arch.test.ts`: green, same test count.
2. Write `code-size.arch.test.ts` first (red). One `GUARDS` table, one entry per guard: its name, its kind (`rule` with group and rule name, or `plugin` with its path), its expected options. Three `describe` blocks:
   - `biome carries the code-size guards`: for each guard, exactly one override in `biome.json` carries it; that override carries nothing else; its `includes[0]` is `src/**`; every other include matches `^!src/[^*?{}\[\]]+\.ts$` (an exact file, never a glob, so no exclusion can silence a folder); the negated entries are sorted and unique; a rule's level is `error` and its options equal the table's. A plugin carrier's `plugins` is exactly `["./biome-plugins/<file>.grit"]`.
   - `the baseline only shrinks`: in `beforeAll`, copy `src/` and `biome-plugins/` into a temp directory. For each guard in turn, write there a minimal `biome.json` enabling only that guard on every file (`recommended: false`, `vcs`, `formatter` and `assist` off; a rule's level and options are read from its carrier override, a plugin by its path, so the measured limit is the configured one), run `biomeFindings`, keep the files of that guard's findings (`lint/<group>/<rule>`, or `plugin` for a plugin run: only one guard runs at a time, so every plugin finding is its own). Compare with the carrier's negated includes through `expectRatchet` (`helpers.ts:84`): `added` must be `[]`, message `new violator of <guard>: fix it, never list it`; `fixed` must be `[]`, message `no longer violates <guard>: remove it from its override in biome.json`. Remove the temp directory in `afterAll`.
   - `the guard itself`: a planted tree built like `biome-guards-bite.arch.test.ts:80-126`, with the real `biome.json` and `biome-plugins/` copied in. Every planted file exports what it declares, so no other rule reports it. One violator per guard under `src/kernel/`, each violating that guard only: a 60-line function; a function of cognitive complexity above 15 under 50 lines (nested `if` and `for` with `&&` chains); a file with two classes; a file of 420 non-blank lines of short `export const` declarations; `four-params.ts` holding a function declaration, an arrow, a class method and an interface method signature of 4 parameters each; a class whose constructor takes 6 parameter properties (`private readonly`). Beside them, one file at each limit: a 40-line function, two short functions, one class, 380 lines, 3 parameters, a constructor of 5 parameter properties. Under `tests/kernel/`, one file breaking all six. One violator of the function-parameters guard written at the path of the first entry of that guard's baseline. Assertions, by `<file>:<rule>` with `biomeFindings`: each `src/kernel/` violator yields its guard's finding (`plugin` for the two plugin guards, the planted file naming the guard); no file at the limit yields any of the six; nothing under `tests/` yields any of the six; the planted baseline path yields no `plugin` finding. One synthetic `expectRatchet` case names a stale baseline entry in `fixed`.
   Run `cd cli && pnpm exec vitest run tests/architecture/code-size.arch.test.ts` and watch the carrier and planted tests fail for the missing overrides.
3. Create the two plugin files with the exact content written to `$B/biome-plugins/` in phase 1.
4. In `cli/biome.json`, insert six overrides before the final `noDefaultExport` override, in the order of the guard table above. Each has `includes: ["src/**", "!<path>", ...]` with its phase 1 list, sorted, and carries one guard: the four rules under `linter.rules.<group>.<rule>` with `level: "error"` and the options of the table; the two plugins under `plugins`. Then `cd cli && pnpm exec biome format --write biome.json`.
5. Run the test again: green. Run `cd cli && pnpm lint`: exit 0.
6. Manual bite checks, reverted after each, kept out of the tree:
   - Delete one negated entry from the function-length carrier, run `cd cli && pnpm lint`: it fails naming that file with `lint/complexity/noExcessiveLinesPerFunction`. Restore.
   - Add `!src/cli.ts` (sorted) to the class-count carrier, run the code-size test: `fixed` names `src/cli.ts`. Restore.
   - Add a fourth parameter to any function in a file outside the function-parameters baseline, run `cd cli && pnpm lint`: it fails with the plugin message. Revert, `git diff --quiet -- <file>`.

Acceptance:

| Command | Expected |
| --- | --- |
| `cd cli && pnpm lint` | exit 0 |
| `cd cli && pnpm exec vitest run tests/architecture/code-size.arch.test.ts tests/architecture/biome-guards-bite.arch.test.ts` | exit 0, every test passed |
| Same command with the six overrides removed from `biome.json` | the carrier and planted tests of `code-size` fail, `biome-guards-bite` stays green; restore |
| Each manual bite check of task 6 | fails naming the file, passes after revert |
| `node -e 'const c=require("./cli/biome.json");console.log(c.overrides.filter(o=>o.includes?.[0]==="src/**"&&o.includes.length>1&&o.includes.slice(1).every(i=>i.startsWith("!src/"))).map(o=>o.includes.length-1).join(" "))'` | `20 32 9 9 93 21` (the final `noDefaultExport` override, also starting with `src/**`, is not selected) |
| `cd cli && pnpm test:arch` | exit 0 (`biome-context-parity`, `import-rules-bite` read only `noRestrictedImports.options.patterns`, which the new overrides do not carry) |
| `git status --porcelain cli` | only the files of the projection |

### Phase 3: Rules and memory (sonnet)

> The size limits are stated once, in one rule merged with the folder limit, and the memory names the guard and its proof.

Architecture projection:

```txt
cli/
├── .claude/rules/00-architecture/
│   ├── 0-folder-size.md         ❌ renamed
│   ├── 0-code-size.md           ✅ git mv of 0-folder-size.md, extended with the six limits
│   └── 0-orchestration.md       ✏️ one line scoping its cap of 4 against the constructor cap of 5
└── aidd_docs/memory/
    └── coding-assertions.md     ✏️ "Before commit" row 1 names the size guards and their proof
```

Tasks:

1. `git mv cli/.claude/rules/00-architecture/0-folder-size.md cli/.claude/rules/00-architecture/0-code-size.md`. Keep `paths: ["src/**/*.ts"]`. Description: `Apply when code grows; size limits for folders, files, functions, parameters and classes.` Body, one bullet per limit, terse like the other rules:
   - Folder: the five existing bullets, unchanged.
   - File: at most 400 non-blank lines, one class.
   - Function: at most 50 non-blank lines, cognitive complexity at most 15.
   - Parameters: a function or method takes at most 3; beyond that, one named object. A constructor takes at most 5 dependencies.
   - Held by `cli/biome.json` on `src/**` (four Biome rules, two plugins in `biome-plugins/`); `code-size.arch.test.ts` proves each bites and that the baseline only shrinks.
   - The baseline is each guard's negated includes; an entry leaves when its file is fixed; never add one.
   - `tests/**` is outside these limits.
2. `cli/.claude/rules/00-architecture/0-orchestration.md`: after line 12, add one bullet: `` Every constructor is also capped at five parameters (`0-code-size.md`); for a use case the four above is stricter and applies. `` No other change (decision D7).
3. `cli/aidd_docs/memory/coding-assertions.md:18`, row 1: reword, do not append, since "the GritQL plugin" becomes three. It reads: biome, lint and format, plus the GritQL plugins under `biome-plugins/` (`process.exit` below the command edge, function and constructor parameters), `noDefaultExport` under `src/` and `tests/`, and the code-size limits on `src/` with their baselines as negated includes; `biome-guards-bite.arch.test.ts` and `code-size.arch.test.ts` prove them on planted trees. No limit values here: their home is the rule (D9).
   Checked and left unchanged: `cli/.claude/rules/03-frameworks-and-libraries/3-cli-process.md:35` names `no-process-exit.grit` only, which stays true; `codebase-map.arch.test.ts` reads only the `src/` tree block of the map, and no `src/` directory is added; `cli/ARCHITECTURE.md:36-44` lists the architecture guards, not size limits.
4. Stale reference check: `git grep -n '0-folder-size' -- ':!aidd_docs/tasks' ':!cli/aidd_docs/tasks'` prints nothing.

Acceptance:

| Command | Expected |
| --- | --- |
| `git grep -n '0-folder-size' -- ':!aidd_docs/tasks' ':!cli/aidd_docs/tasks'` | no output |
| `node scripts/check-doc-duplication.js` | exit 0 |
| `node scripts/check-referenced-paths.js` | exit 0 |
| `node scripts/check-markdown-links.js --ignore cli/tests/fixtures --ignore cli/aidd_docs/tasks` | exit 0 |
| `cd cli && pnpm test:arch` | exit 0 (`referenced-paths`, `docs-do-not-lie`) |
| `grep -c $'\u2014' cli/.claude/rules/00-architecture/0-code-size.md cli/.claude/rules/00-architecture/0-orchestration.md cli/aidd_docs/memory/coding-assertions.md` | the same counts as before the edit |

### Phase 4: Gates and final acceptance (haiku)

> Every repository gate is green and nothing outside the projection changed.

Files touched: none. On a failure, one agent per failing assertion, per `coding-assertions.md`.

Tasks:

1. `pnpm exec lefthook run pre-commit --all-files`.
2. `pnpm exec lefthook run pre-push --all-files`.
3. `cd cli && pnpm test`.
4. `node scripts/check-no-local-paths.js aidd_docs/tasks/2026_11/2026_11_06_test-harness-strategy/plan-pr2-code-size-rules.md`.

Acceptance:

| Command | Expected |
| --- | --- |
| `pnpm exec lefthook run pre-commit --all-files` | exit 0 |
| `pnpm exec lefthook run pre-push --all-files` | exit 0 |
| `cd cli && pnpm test` | exit 0, no failed test |
| Task 4 | exit 0 |
| `git status --porcelain` | the edits and files of phases 2 and 3, and this plan; nothing else, nothing committed |
| `git diff --stat -- cli/src` | empty: no source file changed |

## Resources

| Source | Verified |
| ------ | -------- |
| `cli/node_modules/@biomejs/biome/configuration_schema.json` (Biome 2.5.15) | `UseMaxParamsOptions` has only `max`; `NoExcessiveLinesPerFunctionOptions` has `maxLines`, `skipBlankLines`, `skipIifes`; `NoExcessiveCognitiveComplexityOptions` `maxAllowedComplexity`; `NoExcessiveClassesPerFileOptions` `maxClasses`; `NoExcessiveLinesPerFileOptions` `maxLines`, `skipBlankLines` |
| Scratch run, `useMaxParams` with `max: 5` on planted declarations | it counts constructor parameters, parameter properties included (a 6-property constructor and a 5+1 optional one flagged, a 5-property one not), and also counts a `this` parameter, function types, interface methods, `declare function` and class methods; a rest parameter counts as one, a destructured object as one |
| Scratch run, `useMaxParams` on `src` | `max: 5`: 64 hits, 21 on a constructor line; `max: 3`: 255 hits, 57 on a constructor line |
| Scratch run, GritQL `JsParameters(items=$items)` with `$items <: [$a, $b, $c, $d, ...]` | flags 4 parameters on a function declaration, function expression, arrow, class method, static method, object method, interface method, function type and `declare function`; not 3 parameters, not a 3-parameter callback, not a constructor; counts a `this` parameter as one |
| Scratch run, GritQL `JsConstructorParameters(parameters=$items)` with six items | flags 6 parameters, parameter properties and an optional one included; not 5; `items=` on that node matches nothing |
| Scratch run, GritQL snippet patterns (`` `function $name($a, $b, $c, $d, $...) { $... }` ``, arrow snippets) | match nothing or the wrong node: rejected in favour of node patterns |
| Scratch run, a copy of `cli/biome.json` plus the six carriers with negated includes, on a copy of `src` with a planted file | zero findings of the six guards on the real files; the planted file reports both the existing `no-process-exit` plugin and the new parameter plugin, so plugins from separate overrides accumulate; `!<path>` silences a rule and a plugin for that file; one lint run takes 0.18 s |
| Scratch run, function length boundary with `skipBlankLines: true` | a body of 51 lines inside the braces passes, 52 fails; the planted proofs use 40 and 60 to stay clear of it |

## Decisions

| Decision | Why |
| -------- | --- |
| D1. One file at the requested path, phases inline, with model tier and runnable acceptance per phase, instead of the skill's `plan.md` plus `phase-<n>.md` | The caller fixed the path; PR 1's plan in the same folder uses the same shape (`plan-pr1-test-levels-and-guards.md`, its D1). No `backlog-link.json`: the source names no ticket. |
| D2. Parameters are held by two GritQL plugins, `max-function-params.grit` (more than 3, `JsParameters`) and `max-constructor-params.grit` (more than 5, `JsConstructorParameters`); `useMaxParams` is not enabled | The amended contract needs two thresholds and `UseMaxParamsOptions` has one `max` (schema above). Enabling it at 5 beside a plugin at 3 would report every function over 5 twice and keep two baselines for one fact. Biome plugins are already an error gate here (`biome.json` carrier of `no-process-exit.grit`, proven by `biome-guards-bite.arch.test.ts:49-60,128-132`), so preference (1) of the contract holds. The two node kinds split constructors from everything else without a `where` on the parent (scratch runs above). |
| D3. Preference (2), extending `orchestrator-deps` with the TypeScript compiler API, is not taken, and its premise does not hold | `orchestrator-deps.arch.test.ts:150-157` counts with regular expressions (`constructor\((.*?)\)`, `private readonly \w+`), and no file under `cli/tests` or `cli/scripts` imports `typescript`. Moot since (1) works. |
| D4. The baseline is the negated includes of each guard's own carrier override; one override per guard | Biome cannot express shrink-only. Negated includes keep the rule at `error` for every other file, so a new violator fails `pnpm lint` natively; `code-size.arch.test.ts` adds the other direction (a listed file that no longer violates) by measuring with Biome itself, on a copy, with the carrier's own options. Verified in scratch (Resources). Rejected: inline `biome-ignore` comments (they edit 136 source files, outside "no refactor", and Biome reports an unused one only as `suppressions/unused`, a warning); an enabling override plus an `off` override per rule (verified to work too, twice the surface); a custom counting script (doctrine). A per-guard ceiling constant in `code-size.arch.test.ts` (the `MAX_COMMENT_LINES` pattern) closes the gap that a new violator plus its negated include would otherwise pass: the list may not outgrow today's size. |
| D5. The baseline holds paths only, no per-file count | Same reasoning as PR 1's D10: exact counts on 136 actively edited files would turn the suite red on every edit to them. Limit, stated: a listed file may get worse (a second long function, another 4-parameter method) until the PR that fixes it. |
| D6. `skipBlankLines: true` for file length | Measured both ways on `src`: the same 9 files exceed 400; the nearest file below is `plugins-capability.ts`, 385 lines or 358 non-blank, so the choice changes no verdict today. It matches the function-length setting the contract fixes, so one counting rule applies to all of `src`, and a formatting blank line never pushes a file over. |
| D7. `orchestrator-deps.arch.test.ts` stays; the cap of 4 in `0-orchestration.md` is not changed here | The arch test measures something Biome does not: it adds each distinct `new XUseCase(` in the class body to the `private readonly` count (`:150-157`), scoped to `src/contexts/*/application/`, at a cap of 4, with an exact count per entry. Measured overlap: the 21 files the constructor plugin flags are all among its 37 entries; the other 17 sit at 5, or reach the cap through inline instances (`generate-tool-distribution-use-case.ts` has 5 distinct `new XUseCase(`). Replacing the 4 by the 5 is the guideline PR's, by `00-overview.md` section 11 item 7 and section 15 ("Command cap"), which ties it to splitting the four telemetry commands at 6 or to pilot evidence, and `08-guardrails-and-repo-map.md` section 7 step 5 removes that baseline once the computed rule is in place. This PR only scopes the two caps against each other in one line, as `CLAUDE.md` asks for an overlapping rule. |
| D8. `noExcessiveClassesPerFile` does not apply to `tests/**` | Measured on `tests`: 13 files, among them `tests/helpers/ports/in-memory-file-adapter.ts`, `in-memory-telemetry.ts`, `scripted-prompter.ts` and several integration tests that declare their fakes beside the test. The rule's reason is the command pattern (one file, one class, overview section 7), which concerns `src`; test files and doubles group small fakes by design, and the contract puts test-file rules out of scope. |
| D9. The limits live in one rule, `0-folder-size.md` renamed `0-code-size.md`, not in a new parallel rule | `0-folder-size.md` already holds the one size limit and the same baseline discipline; a second size rule would split one concern. No live reference names the old file (`git grep` outside task folders prints nothing). `0-hexagonal.md:17` ("one class per use case") agrees with one class per file and stays. Memory names the guard and its proof, not the numbers, so `check-doc-duplication.js` has no sentence to find twice. |
| D10. Port signatures count toward the function-parameters limit | The plugin flags 6 sites `useMaxParams` at 3 does not: interface methods and function types in `marketplace-registry.ts:8,14`, `transcript-source.ts:29`, `build-contract.ts:95,120`, `plugin-translator.ts:21`. Their implementations are flagged anyway; the named object starts at the port, so counting it keeps the two together. 198 non-constructor hits for `useMaxParams` at 3, 204 for the plugin. |
| D11. A `this` parameter counts as a parameter; stated as a limit, not handled | Both `useMaxParams` and the plugin count it (scratch runs). No `this:` parameter exists in `cli/src` (`grep -rnE '\(this:' cli/src` is empty), so by "write no code for an input never observed" it is a written limit only. |
| D12. `biomeFindings` moves to `helpers.ts` instead of being copied | `code-size.arch.test.ts` needs the same Biome runner and GitHub-reporter parser as `biome-guards-bite.arch.test.ts:14-47`; a second copy is two homes for one fact (`cli/aidd_docs/memory/coding-assertions.md:9`). The move is the textual conflict point with PR 1, settled by rebase. |
| D13. The baseline counts are the ones measured on this branch, not the contract's | The contract gave 41 for cognitive complexity and 62 for `useMaxParams` at 5; an isolated config on this tree gives 43 and 64 (and 28, 9, 9 as given for the other three). Under the amended contract the parameter counts are 204 functions in 93 files and 21 constructors in 21 files. |

Two findings outside this PR, noted and left: `cli/src/contexts/framework/application/uninstall/uninstall-use-case.ts:33` raises a `noUnusedPrivateClassMembers` warning today; `0-orchestration.md:11` says "four other use cases" while `orchestrator-deps` counts every `private readonly` constructor parameter, ports included (its guard test at `:228`), a wording for the guideline PR.
