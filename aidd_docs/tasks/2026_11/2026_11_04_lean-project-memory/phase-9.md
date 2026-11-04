---
status: pending
---

# Instruction: One hooks descriptor per tool

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── cli/src/contexts/tools/domain/
    ├── formats/hooks-descriptor.ts ✅
    ├── capabilities/hooks-capability.ts ✏️
    └── profiles/
        ├── claude/hooks.ts ✅
        ├── codex/hooks.ts ✅
        ├── copilot/hooks.ts ✅
        ├── cursor/hooks.ts ✅
        ├── opencode/hooks.ts ✅
        ├── kilo/hooks.ts ✅
        └── */profile.ts, */build.ts ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | phase 8 green | today's output pinned | system |
| Happy path | each tool's hooks facts read from its descriptor | phase 8 and the goldens unchanged | system |
| Edge case | a tool with no hooks (vscode) | no descriptor, no hook written | system |
| Edge case | a descriptor without a payload fixture | the contract test fails naming the tool | system |

## Tasks to do

### `1)` The descriptor

> What differs per tool is data.

1. `HooksDescriptor`: per route, destination and entry shape (nested or flat; Copilot's native tree keeps the nested form today); wrapper, event map (one event to several, unmapped reported), fields kept, root token, one file or one file per plugin, runtime (`command` or `bridge`).
2. One `hooks.ts` per tool; `build.ts` and `profile.ts` read it instead of declaring hooks facts.
3. `HooksCapability` has readers (`contracts.ts`, `framework/domain/config-capability.ts`): delete only `merge` and the dead Codex `mergeFn`, and move what its readers need onto the descriptor; empty phase 7's baselines for them.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | phase 8 and goldens byte-identical; `tool-hooks-one-descriptor` baseline empty; mutation on `tools-*` scopes holds its floors |
