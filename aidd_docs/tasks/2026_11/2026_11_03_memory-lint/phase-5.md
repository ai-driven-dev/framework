---
status: done
---

# Instruction: Each tool's hook format in its profile, Cursor's keeping the matcher

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── cli/
    ├── src/contexts/
    │   ├── tools/domain/
    │   │   ├── capabilities/plugins-capability.ts ✏️
    │   │   ├── formats/
    │   │   │   ├── plugin-hooks-shape.ts ✅
    │   │   │   ├── flat-hooks-merge.ts ❌
    │   │   │   └── cursor-hooks-project-merge.ts ❌
    │   │   └── profiles/
    │   │       ├── claude/hooks-format.ts ✅
    │   │       ├── claude/build.ts ✏️
    │   │       ├── codex/hooks-format.ts ✅
    │   │       ├── codex/build.ts ✏️
    │   │       ├── copilot/hooks-format.ts ✅
    │   │       ├── copilot/build.ts ✏️
    │   │       ├── cursor/hooks-format.ts ✅
    │   │       ├── cursor/build.ts ✏️
    │   │       ├── cursor/profile.ts ✏️
    │   │       ├── kilo/kilo-hooks-bridge.ts ✏️
    │   │       └── opencode/opencode-hooks-bridge.ts ✏️
    │   └── framework/application/
    │       ├── framework/translator/project-hooks-materializer.ts ✏️
    │       └── shared/remove-project-hooks.ts ✏️
    └── tests/
        ├── architecture/
        │   ├── context-boundary.arch.test.ts ✏️
        │   └── tool-addition-cost.arch.test.ts ✏️
        └── contexts/
            ├── tools/domain/
            │   ├── formats/flat-hooks-merge.unit.test.ts ❌
            │   ├── formats/cursor-hooks-project-merge.unit.test.ts ❌
            │   └── profiles/
            │       ├── claude/hooks-format.unit.test.ts ✅
            │       ├── codex/hooks-format.unit.test.ts ✅
            │       ├── copilot/hooks-format.unit.test.ts ✅
            │       └── cursor/hooks-format.unit.test.ts ✅
            ├── tools/domain/capabilities/plugins-capability.unit.test.ts ✏️
            └── framework/application/
                ├── clean-use-case.unit.test.ts ✏️
                ├── shared/remove-project-hooks.unit.test.ts ✏️
                └── framework/translator/project-hooks-materializer.unit.test.ts ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | the CLI suite green, `golden.json` recorded, before any move | baseline | system |
| Happy path   | after the move, install, reinstall and remove plugins with hooks for each tool | the same files, byte for byte, and `golden.json` identical | system |
| Edge case    | a file in `application/` or `domain/formats/` declaring or importing an identifier named after a tool | the guardrail fails it, unless the baseline lists it | system |
| Edge case    | a `project` hooks destination without a format | the capability refuses it at construction | system |
| Happy path   | translate a `PostToolUse` group with matcher `Write\|Edit\|MultiEdit` for Cursor, flat and per project | each Cursor entry carries the matcher; a group without one gives entries without | system |
| Edge case    | reinstall over a `.cursor/hooks.json` holding the plugin's older entries without a matcher | one entry per command, older ones replaced, other plugins' untouched | system |
| Edge case    | remove a plugin installed by an older CLI | its entries are removed, their digests still match | system |
| Teardown     | none | baseline restored | system |

## Tasks to do

### `1)` Guardrail

> Code outside a profile never names a tool, so the next host changes one profile only.

1. Extend `tool-addition-cost.arch.test.ts` with a form for identifiers: a file under `application/` or `domain/formats/` declaring or importing one that names a tool fails.
2. Measure today's violations and record them as its baseline, which may only shrink; this phase removes the hook entries, and #1143 owns the rest.
3. In the existing literal-form baseline, drop the entry for `cursor-hooks-project-merge.ts`, which this phase deletes.

### `2)` One home per hook format

> Each tool's hook format sits in its own profile, the shared source shape in one place.

1. Move each of `mergeClaudeSettingsHooks`, `mergeCodexFrameworkHooksJson`, `flattenCopilotHooksShape`, `mergeCursorFlatHooks` with its helpers, and the whole of `cursor-hooks-project-merge.ts`, into `profiles/<tool>/hooks-format.ts`, with their tests.
2. Put the source shape types in `formats/plugin-hooks-shape.ts` under neutral names (`PluginHooksShape`, `PluginMatcherGroup`, `PluginHookItem`), since the guardrail refuses a tool name there, and use them from the Kilo and OpenCode bridges instead of their copies.
3. Repoint `clean-use-case.unit.test.ts`, which imports `cursorProjectHooksScriptDir`, at the Cursor profile.

### `3)` The application reads the capability

> The project-hooks route asks the capability for its format.

1. Add `projectHooksFormat` (merge, unmerge, script path, script directory) to `PluginsCapability`, required exactly when `hooksDestination` is `project` and checked at construction, with its case in `plugins-capability.unit.test.ts`; give the Cursor profile its own.
2. Make `project-hooks-materializer.ts` and `remove-project-hooks.ts` take it from the capability; drop `flat-hooks-merge.ts` and `cursor-hooks-project-merge.ts` from `PUBLIC_MODULES` in `context-boundary.arch.test.ts`.

### `4)` No behaviour changed

> The move changes where code lives, nothing it writes.

1. Run `cd cli && pnpm test`, the golden suite included and unchanged, and commit the move on its own.

### `5)` Keep the matcher

> A Cursor hook entry keeps its group's matcher, which Cursor honours.

1. Write the failing tests first: the matcher in `profiles/cursor/hooks-format.unit.test.ts`; a reinstall over older entries in `project-hooks-materializer.unit.test.ts`; the removal of an older install in `remove-project-hooks.unit.test.ts`.
2. In `profiles/cursor/hooks-format.ts`, copy `group.matcher` onto each entry, flat and per project.
3. Leave `convertClaudeHooksToCursorPlugin` (`cli/src/contexts/translate/domain/formats/cursor-hooks.ts`) as it is: Cursor never fires a plugin-scope `hooks.json` (`profiles/cursor/profile.ts`).

### `6)` CLI gates

> The CLI's own checks pass.

1. Run `cd cli && pnpm test`, then the mutation scopes the moved code lands in, each at its floor in `cli/mutation-scopes.json`: `pnpm test:mutation:tools`, `tools-claude`, `tools-codex`, `tools-copilot`, `tools-cursor`, `tools-kilo`, `tools-opencode`.
2. Run `pnpm exec lefthook run pre-commit` and `pnpm exec lefthook run pre-push`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | a new tool-named identifier under `application/` or `domain/formats/` fails the test; the baseline lists only what #1143 owns |
| 2 | no hook format lives outside its tool's profile, and the bridges share one source shape |
| 3 | no application file imports a Cursor module; a `project` destination without a format fails at construction |
| 4 | every existing test passes unchanged in what it asserts, and `golden.json` is identical |
| 5 | a matched group's Cursor entries carry its matcher, an unmatched group's carry none, reinstall and removal behave as before, and `translate/domain/formats/cursor-hooks.ts` is unchanged |
| 6 | the CLI suite, every touched mutation scope at its floor, the pre-commit and the pre-push pass |
