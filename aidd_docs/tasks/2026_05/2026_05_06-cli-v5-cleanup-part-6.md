# Phase 6 — Globaux chainés

> Reframe global commands (`update`, `status`, `sync`, `restore`, `doctor`) as orchestrators that chain the per-domain unitaries from Phase 5.

## Pre-requisites

- Phase 5 (noun-first split) landed — `aidd ai/ide/plugin <op>` exist

## Goal

Global commands today either operate flat or take `[category]` arg. Post Phase 5, globals invoke the noun-first unitaries:

| Global | Chain |
|---|---|
| `aidd update` | `ai update` + `ide update` + `plugin update` + `marketplace refresh` |
| `aidd status` | `ai status` + `ide status` + `plugin status` |
| `aidd sync` | (interactive only) prompts source → calls `ai sync` then `plugin sync` |
| `aidd restore` | `ai restore` + `plugin restore` (interactive picks) |
| `aidd doctor` | `ai doctor` + `ide doctor` + `plugin doctor` |
| `aidd clean` | unchanged (single-shot full nuke) |

## Architecture compliance

- Each global command calls ONE orchestrator use-case in `src/application/use-cases/global/`
- Orchestrator use-cases compose per-domain use-cases (do not duplicate logic)
- Orchestrators tolerate per-domain failures: error in `plugin update` doesn't abort `ai update` already done — collect errors, surface aggregate result at end
- Orchestrator returns a typed `GlobalResult` discriminated union

```ts
// src/application/use-cases/global/update-all-use-case.ts
export interface UpdateAllResult {
  ai: ToolUpdateResult[];
  ide: ToolUpdateResult[];
  plugins: PluginUpdateResult[];
  marketplaceRefresh: MarketplaceRefreshResult;
  errors: GlobalExecutionError[];
}
```

## Steps

### A. Create `src/application/use-cases/global/`

- [ ] `update-all-use-case.ts` — chains `UpdateAiUseCase`, `UpdateIdeUseCase`, `PluginUpdateUseCase`, `MarketplaceRefreshUseCase`. Returns aggregated result. Continues on per-step error.
- [ ] `status-all-use-case.ts` — chains `StatusUseCase` with category filter `"ai"`, `"ide"`, plus plugin status. Aggregates `StatusReport`.
- [ ] `sync-all-use-case.ts` — interactive only (throw if non-TTY). Prompts source, then chains `SyncUseCase` (configs) + `SyncPluginsUseCase` (plugins, Phase 8).
- [ ] `restore-all-use-case.ts` — chains `RestoreUseCase` (configs) + `RestorePluginsAllUseCase` (each tracked plugin). Interactive prompts to pick files.
- [ ] `doctor-all-use-case.ts` — chains `DoctorUseCase` for AI / IDE / plugins. Aggregates issues.

### B. Update commands

- [ ] `commands/update.ts` — call `UpdateAllUseCase`, display aggregated `UpdateAllResult`
- [ ] `commands/status.ts` — call `StatusAllUseCase`, display aggregated report (sections per scope)
- [ ] `commands/sync.ts` — call `SyncAllUseCase` (interactive only), error in non-TTY without explicit `--source`
- [ ] `commands/restore.ts` — call `RestoreAllUseCase`, display aggregated result
- [ ] `commands/doctor.ts` — call `DoctorAllUseCase`, exit non-zero if any error issue surfaces

### C. Drop redundant flags

- [ ] `commands/status.ts` — drop `[category]` argument (use `aidd ai status` / `aidd ide status` / `aidd plugin status` instead)
- [ ] `commands/doctor.ts` — drop `[category]` argument
- [ ] `commands/restore.ts` — drop `--tool` flag (use `aidd ai restore --tool <id>` instead)
- [ ] `commands/sync.ts` — drop `--source` flag from global (only on `aidd ai sync` / `aidd plugin sync`)

### D. Wire deps

- [ ] `deps.ts` exposes orchestrators: `updateAllUseCase`, `statusAllUseCase`, `syncAllUseCase`, `restoreAllUseCase`, `doctorAllUseCase`
- [ ] Each orchestrator constructed with the per-domain use-cases as constructor deps (single execute method)

## Tests (unit-first)

### Unit tests

- [ ] `tests/application/use-cases/global/update-all-use-case.unit.test.ts` — happy path, partial failure (continues), all-fail aggregate result
- [ ] `tests/application/use-cases/global/status-all-use-case.unit.test.ts` — combined report shape
- [ ] `tests/application/use-cases/global/sync-all-use-case.unit.test.ts` — non-TTY rejection
- [ ] `tests/application/use-cases/global/restore-all-use-case.unit.test.ts` — interactive flow with mocked prompter
- [ ] `tests/application/use-cases/global/doctor-all-use-case.unit.test.ts` — exit code derivation from aggregated issues

### Integration tests

- [ ] One integration test per orchestrator using in-memory FS port + real (or stubbed) sub-use-cases — verify chaining order

### E2E tests

- One E2E covering `aidd update` global chain in Phase 11

## Acceptance criteria

- [ ] `aidd update` chains AI update + IDE update + plugin update + marketplace refresh in one call
- [ ] `aidd update` surfaces partial failures cleanly (one tool fails, rest still update)
- [ ] `aidd status` reports across all 3 scopes
- [ ] `aidd doctor` exits 0 if all healthy, exits 1 if any error
- [ ] `aidd sync` non-TTY: errors with "use aidd ai sync --source <tool>"
- [ ] `aidd restore` interactive: prompts, applies selection
- [ ] `aidd clean` unchanged behavior
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm biome check` all clean

## Manual validation

```bash
cd /tmp && rm -rf v5-globals && mkdir v5-globals && cd v5-globals
aidd setup --source remote --all --no-plugins --yes

# Update global
aidd update
# expect: AI tools updated + IDE tools updated + (no plugins) + marketplace refreshed

# Status global
aidd status
# expect: sections "AI tools:", "IDE tools:", "Plugins:" — all "in sync"

# Doctor
aidd doctor
echo $?  # expect 0

# Sync TTY
aidd sync
# expect: prompt for source

# Sync non-TTY (CI-style)
echo | aidd sync 2>&1 | grep -i "use aidd ai sync"
```

## Risks / breaking changes

- `aidd status [category]` and `aidd doctor [category]` arg form gone — users must use noun-first `aidd ai status` etc. Document in CHANGELOG.
- `aidd sync --source <tool>` flag relocated to `aidd ai sync --source <tool>` and `aidd plugin sync --source <tool>` — same.
- `aidd restore --tool <tool>` flag relocated.
- Aggregated error output format changes — any user parsing CLI output needs update (none expected).

## Commit

```
feat(global): chain per-domain unitaries in global commands

Globals now orchestrate per-domain operations:
- aidd update => ai update + ide update + plugin update + marketplace refresh
- aidd status => ai status + ide status + plugin status
- aidd sync   => prompts source then ai sync + plugin sync
- aidd restore=> ai restore + plugin restore
- aidd doctor => ai doctor + ide doctor + plugin doctor

Drop [category] argument and tool/source flags from globals — use noun-first
unitaries for scope filtering instead.

Add UpdateAll/StatusAll/SyncAll/RestoreAll/DoctorAll orchestrator use-cases.
Each tolerates per-step failures and aggregates results.

Refs: aidd_docs/tasks/2026_05/2026_05_06-cli-v5-cleanup-part-6.md
```
