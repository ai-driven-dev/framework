---
status: pending
---

# Instruction: CLI cleanup: baselines emptied on the hook path

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── cli/
    ├── src/contexts/tools/domain/build-contract.ts ✏️
    ├── src/contexts/tools/domain/profiles/codex/profile.ts ✏️
    ├── src/contexts/tools/domain/profiles/{codex,kilo,opencode}/build.ts ✏️
    ├── src/contexts/translate/application/ ✏️
    └── aidd_docs/memory/architecture.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | phase 7's baselines after phases 9 to 11 | what remains on the hook path | system |
| Happy path | `emitConfigArtifact` returns content; the application writes it | no domain file imports a file port on the hook and config path | system |
| Edge case | the dead Codex memory entry and `convertClaudeHooksToCursorPlugin` | deleted; knip and goldens unchanged | system |

## Tasks to do

### `1)` I/O out of the domain

> The domain returns what to write; the application writes.

1. `emitConfigArtifact` becomes a pure function returning files; `flat-build-strategy.ts` and `marketplace-build-strategy.ts` do the reads and writes.
2. Remove those files from phase 7's baseline; entries off the hook path stay, each with its reason.

### `2)` Dead code

> Nothing kept for the record.

1. Delete the hardcoded `node .aidd/scripts/update_memory.cjs` entry and its constants in `codex/profile.ts`, and `convertClaudeHooksToCursorPlugin`.

### `3)` CLI bank

> The next reader knows where hooks live.

1. One line in `cli/aidd_docs/memory/architecture.md`: hooks are a descriptor per tool, one engine, one converter; adding a tool is a descriptor and a fixture.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1-2 | `pnpm lint`, `test:arch`, `knip`, `pnpm test` pass; baselines only shrank |
| 3 | `docs-do-not-lie.arch.test.ts` passes |
