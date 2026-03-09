---
id: 071
milestone: M7
title: "Implement SyncUseCase and sync command"
stories: [US-023, US-025]
points: 7
blockedBy: [070]
---

# 071: Implement SyncUseCase and sync command

## Context
The sync command propagates user changes from one tool to all other installed tools. It reverse-rewrites source tool content to canonical format, then forward-rewrites to each target tool. This is the differentiator for multi-tool users.

## Scope
Implement SyncUseCase and the sync command with `--source`, `--target`, and `--force` flags.

## Acceptance Criteria
- [ ] `aidd sync --source claude` detects changes in Claude files, reverse-rewrites to canonical, forward-rewrites to all other installed tools
- [ ] Changes are detected by comparing disk hash vs manifest hash for source tool
- [ ] Reverse rewrite: tool-specific content -> canonical content
- [ ] Forward rewrite: canonical content -> target tool-specific content
- [ ] `--target cursor` limits propagation to cursor only
- [ ] Fewer than 2 installed tools: fails with "Sync requires at least 2 installed tools"
- [ ] `--source claude --target claude`: fails with "Source and target must be different tools"
- [ ] Skip identical content: if target already has the same content after rewriting, skip
- [ ] Excluded files: memory bank, MCP config, VS Code files, docs, and manifest are NEVER propagated
- [ ] Manifest updated for both source and target tools after sync
- [ ] Success output: lists synced files per target tool

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `error.sync.*`, `success.sync`, `progress.sync.propagating`, `help.sync.description`, `help.opt.source`, `help.opt.target`, `help.opt.force.sync`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.10 for sync flow state table and recovery paths.
- SyncUseCase: load manifest -> read source tool files from disk -> filter modified ones -> reverse rewrite via ToolSpec -> for each target tool: forward rewrite -> detect if target has modifications (conflict) -> write non-conflicting -> update manifest.
- This ticket does NOT handle conflicts (that's 072). Non-conflicting changes are propagated silently.
- Excluded file detection: check file path against known exclusion patterns (memory bank, MCP, VS Code, docs).

## Files to Create/Modify
- `src/application/use-cases/sync-use-case.ts` -- SyncUseCase
- `src/presentation/commands/sync.ts` -- commander registration with --source, --target, --force
- `tests/application/use-cases/sync-use-case.test.ts` -- unit tests
- `tests/presentation/commands/sync.test.ts` -- command tests

## Tests
- Sync from claude to cursor: correct content transformation
- Sync from claude to all installed tools
- Sync with --target limitation
- Fewer than 2 tools: error
- Source = target: error
- Skip identical content on target
- Excluded files not propagated
- Manifest updated for both tools

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
