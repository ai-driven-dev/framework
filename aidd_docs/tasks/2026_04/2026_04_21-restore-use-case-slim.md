---
name: restore-use-case-slim
description: Slim RestoreUseCase from 582 lines to < 300 by extracting domain logic and simplifying the restore flow
---

# Instruction: RestoreUseCase Slim-Down

## Feature

- **Summary**: `RestoreUseCase` at 582 lines has grown into a multi-concern class handling drift detection, decision resolution, merge-section restoration, docs restoration, and MCP restoration. Each concern should be a clearly-named private method group or extracted to domain models.
- **Stack**: TypeScript, Node.js, Vitest
- **Branch name**: `refactor/restore-use-case-slim`
- **Parent**: `feat/124-vscode-standalone-tool-part-2` (merge base)
- **Target**: < 300 lines

## Context

Current private method inventory (`src/application/use-cases/restore-use-case.ts`, 582 lines):

| Method | Lines | Concern |
|--------|-------|---------|
| `executeRestore` | ~49 | Top-level coordinator |
| `resolveToolIds` | ~5 | Tool resolution |
| `restoreAllTools` | ~30 | Loop over tools |
| `restoreOneTool` | ~47 | Per-tool restore |
| `commitToolRestore` | ~16 | Manifest commit |
| `existingFilesAsGenerated` | ~8 | Conversion |
| `restoreMergeSection` | ~13 | Merge restore |
| `collectMergeDrift` | ~17 | Drift detection (merge) |
| `checkOneMergeFileDrift` | ~31 | Drift check per merge file |
| `applyMergeRestorations` | ~31 | Apply merge patches |
| `resolveRestoreDecision` | ~19 | Decision (force/interactive/prompt) |
| `applyOneMergeRestore` | ~17 | Apply one merge patch |
| `restoreSection` | ~26 | Section restore |
| `restoreDocs` | ~35 | Docs restore |
| `buildRestoreTotals` | ~11 | Aggregation |
| `collectDrift` | ~40 | Drift detection (files) |
| `applyRestorations` | ~38 | Apply file patches |

## Phase 1 — Extract domain logic

### Checklist

- [ ] `collectDrift` + `collectMergeDrift` + `checkOneMergeFileDrift` → these are pure comparisons between manifest state and disk state; consider extracting to `Manifest.collectDriftForTool(toolId, projectRoot, fs)` or a `RestoreDriftDetector` helper
- [ ] `buildRestoreTotals` → pure aggregation; if only used internally, keep as private; if reusable, move to domain
- [ ] `existingFilesAsGenerated` → pure conversion; evaluate if it belongs in `GeneratedFile` domain model

## Phase 2 — Simplify the merge restore flow

### Checklist

- [ ] `restoreMergeSection` / `applyMergeRestorations` / `applyOneMergeRestore` / `resolveRestoreDecision` — these 4 methods handle one logical concern (merge file restoration with conflict resolution); group them clearly and verify they respect the 20-line method limit
- [ ] `resolveRestoreDecision` is already extracted (done in PR #143) — verify it's clean and under 20 lines

## Phase 3 — Simplify `restoreOneTool`

### Checklist

- [ ] `restoreOneTool` (47 lines) is the primary coordinator — it calls drift detection, applies restorations, restores merge sections. Verify each sub-call is a named method. Ensure it's ≤ 20 lines by extracting any remaining inline logic.
- [ ] `restoreSection` (26 lines) — verify under 20 lines; split if not

## Phase 4 — Verify and measure

### Checklist

- [ ] `pnpm typecheck && pnpm test`
- [ ] `wc -l src/application/use-cases/restore-use-case.ts` → < 300
- [ ] All method sizes ≤ 20 lines (count non-blank lines per method)
- [ ] `pnpm knip` — no dead exports

## Risk

- Medium-High — restore semantics are subtle (force vs interactive vs skip, merge vs file restore). Do NOT change behavior, only reorganize structure.
- Regression risk: merge file drift detection must remain correct; add tests for any extracted domain logic
- `resolveRestoreDecision` is already extracted — do not re-extract or rename it again
