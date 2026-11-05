---
status: pending
---

# Instruction: One engine merges and unmerges a plugin's hooks

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── cli/src/contexts/
    ├── tools/domain/formats/hooks-merge.ts ✅
    ├── tools/domain/profiles/{claude,codex,copilot,cursor}/hooks-format.ts ❌
    ├── translate/domain/formats/cursor-hooks.ts ❌
    ├── translate/application/strategies/flat-build-strategy.ts ✏️
    ├── translate/application/strategies/marketplace-build-strategy.ts ✏️
    ├── framework/application/framework/translator/project-hooks-materializer.ts ✏️
    └── framework/application/shared/remove-project-hooks.ts ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | phase 9 green | descriptors in place | system |
| Happy path | every route writes and removes hooks through the engine | phase 8 and goldens unchanged | system |
| Edge case | the same plugin merged twice into one file | one set of entries: the engine removes the plugin's own entries before adding, for every tool | system |
| Edge case | a file holding another plugin's or a person's entries | kept untouched | system |
| Edge case | a file already holding this plugin's entries, another plugin's and a person's, merged into before the shared `mergeHooks` replaces the per-tool merges | the strip removes only this plugin's entries, for every tool route, flat included | system |
| Edge case | an event the tool does not map | skipped and reported, as Cursor does today | system |

## Tasks to do

### `1)` The engine

> Pure functions over text and a descriptor; the caller reads and writes.

1. `mergeHooks(existing, pluginHooks, plugin, descriptor)` and `unmergeHooks(existing, plugin, descriptor)`: rewrite the root token, map events, shape entries, strip the plugin's own entries by its script directory, add.
2. Tests first: before any per-tool merge is replaced, one test per tool route merges this plugin into a file holding this plugin's entries, another plugin's and a person's, and asserts only this plugin's were stripped. Then one per descriptor field, then the five routes moved onto it; delete the per-tool merge, flatten and token-rewrite copies and `cursor-hooks.ts`.
3. `remove-project-hooks.ts` and `project-hooks-materializer.ts` read the descriptor instead of naming Cursor.

### `2)` Stated limit

> Rerunning `translate` into a non-empty folder was never observed in a real flow: `scripts/dev-sync.sh` empties it, CI writes a fresh one.

1. The engine's strip-then-add makes a rerun idempotent anyway; no other code for it. The goldens change only where phase 8 recorded a doubled entry, named in the commit.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | phase 8 identical except the named idempotence change; `jscpd:profiles` baseline empty for hooks; `hooks-merge.ts` mutation score at or above the `tools` floor |
| 2 | no test or code for a rerun beyond the engine's own tests |
