# Part 1 — Format adapters marketplace

> Ingest native marketplace formats from Cursor, Copilot (VS Code), and Codex. Pipeline: `NativeFormat → Parser → NormalizedPlugin → Emitter[targetTool] → ToolNativeFiles`. OpenCode deferred. Unlocks consumption of foreign marketplaces.

## Pre-requisites

- Branch `feat/plugin-architecture` HEAD — current plugin sync 12/12 PASS
- Sync matrix documented: `2026_05_06-cli-v5-cleanup-sync-matrix.md`
- Locked decision #12 context read (MCP translation and copilot/codex component dirs deferred)
- No other part required — this is the unlock for Part 2 and Part 3

## Goal

Today `PluginCatalogRepository.load()` reads only the AIDD native `marketplace.json` format. Foreign marketplaces (Cursor extension registry, VS Code Copilot plugin manifests, OpenAI Codex plugins) each expose their own schema. This part introduces a format-adapter pipeline so the CLI can:

1. Fetch a foreign marketplace URL
2. Parse it into a `NormalizedPlugin` intermediate representation
3. Re-emit per-target tool via existing emitters (extended in Part 2)

This is high-effort (~2–3 weeks): phased A → B → C, D deferred.

| Phase | Format | Status |
|---|---|---|
| A | Cursor extensions | Implement |
| B | Copilot/VS Code agent plugins | Implement |
| C | Codex plugins (OpenAI) | Implement |
| D | OpenCode | Deferred — see Part 3 |

## Architecture compliance

### New domain types (domain pure, no I/O)

- `src/domain/models/normalized-plugin.ts` — capability AST, tool-agnostic
  - Fields: `id`, `name`, `version`, `capabilities: NormalizedCapability[]`
  - `NormalizedCapability` discriminated union: `CommandCapability | RuleCapability | SkillCapability | AgentCapability | HookCapability | McpCapability`
  - No adapter imports; no I/O
- `src/domain/models/foreign-marketplace.ts` — `{ source: ForeignMarketplaceSource; url: string }`
  - `ForeignMarketplaceSource` union: `"cursor" | "copilot" | "codex"` (opencode deferred)

### New adapters (infra layer)

One adapter per format in `src/infrastructure/adapters/`:

- `cursor-marketplace-adapter.ts` — implements `ForeignMarketplaceParser`
- `copilot-marketplace-adapter.ts`
- `codex-marketplace-adapter.ts`

Port `ForeignMarketplaceParser` in `src/domain/ports/foreign-marketplace-parser.ts`:

```typescript
export interface ForeignMarketplaceParser {
  parse(raw: unknown): NormalizedPlugin[];
  supports(source: ForeignMarketplaceSource): boolean;
}
```

### Extended repository

`PluginCatalogRepository` gains one new method:

```typescript
loadForeign(url: string, parser: ForeignMarketplaceParser): Promise<NormalizedPlugin[]>;
```

AIDD native format stays via existing `load()` — no breaking change.

### Emitter extension

Each tool emitter in `src/domain/tools/ai/<tool>.ts` receives a new method:

```typescript
emitFromNormalized(plugin: NormalizedPlugin, projectRoot: string): EmitResult
```

Delegated to capability handlers extended in Part 2.

## Steps

### Phase A — Cursor format adapter

- [ ] Research Cursor marketplace schema (https://cursor.com/docs/plugins) — document field mapping in this file
- [ ] Create `src/domain/models/normalized-plugin.ts` with discriminated `NormalizedCapability` union
- [ ] Create `src/domain/models/foreign-marketplace.ts`
- [ ] Create `src/domain/ports/foreign-marketplace-parser.ts` (interface, ≤5 methods)
- [ ] Create `src/infrastructure/adapters/cursor-marketplace-adapter.ts` implementing the port
- [ ] Add `loadForeign()` to `PluginCatalogRepository` port + adapter
- [ ] Add `emitFromNormalized()` stub to `src/domain/tools/ai/cursor.ts` (cursor → cursor self-emit)
- [ ] Unit test: `tests/infrastructure/adapters/cursor-marketplace-adapter.unit.test.ts` — parse fixture JSON, assert `NormalizedPlugin[]`
- [ ] Unit test: `tests/domain/models/normalized-plugin.unit.test.ts` — invariants, invalid capability throws

### Phase B — Copilot format adapter

- [ ] Research VS Code Copilot agent plugin manifest schema (https://code.visualstudio.com/docs/copilot/customization/agent-plugins)
- [ ] Create `src/infrastructure/adapters/copilot-marketplace-adapter.ts`
- [ ] Add `emitFromNormalized()` to `src/domain/tools/ai/copilot.ts`
- [ ] Unit test fixture + parser tests

### Phase C — Codex format adapter

- [ ] Research OpenAI Codex plugin schema (https://developers.openai.com/codex/plugins/build)
- [ ] Create `src/infrastructure/adapters/codex-marketplace-adapter.ts`
- [ ] Add `emitFromNormalized()` to `src/domain/tools/ai/codex.ts`
- [ ] Unit test fixture + parser tests

### All phases

- [ ] Wire `ForeignMarketplaceParser` adapters in `deps.ts` (selector by `ForeignMarketplaceSource`)
- [ ] Update `PluginCatalogRepositoryAdapter` with `loadForeign()` implementation
- [ ] Extend `plugin install` command to accept `--foreign-source cursor|copilot|codex`
- [ ] Update command-matrix harness to include foreign-source install paths

## Tests

### Unit tests (per phase)

- `cursor-marketplace-adapter.unit.test.ts` — parse valid fixture, unknown fields ignored, empty array on empty catalog
- `copilot-marketplace-adapter.unit.test.ts`
- `codex-marketplace-adapter.unit.test.ts`
- `normalized-plugin.unit.test.ts` — invalid capability discriminant throws, equals(), round-trip

### Integration tests

- `plugin-catalog-repository-adapter.integration.test.ts` — `loadForeign()` with in-memory HTTP stub returning fixture JSON

### No new E2E tests (≤6 budget kept, network-E2E is Part 5)

## Acceptance criteria

- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `NormalizedPlugin` and `NormalizedCapability` types have zero `any` — enforced by biome
- [ ] `aidd plugin install --foreign-source cursor <url>` parses and installs at least one capability
- [ ] Existing 12/12 plugin sync matrix still PASS (no regression)
- [ ] `ForeignMarketplaceParser` port has ≤5 methods
- [ ] `PluginCatalogRepository` port has ≤5 methods total after adding `loadForeign()`

## Manual validation

```bash
# Phase A smoke — requires Cursor marketplace fixture URL
aidd plugin install --foreign-source cursor https://example.cursor.com/marketplace.json

# Regression check
aidd plugin sync --source claude --target cursor
# expect: exit 0, aidd-test@0.1.0 propagated (same as sync matrix)
```

## Risks / breaking changes

- `PluginCatalogRepository` port gains `loadForeign()` — all existing mocks need updating (mechanical but broad)
- Cursor/Copilot/Codex schemas may change without notice; parsers should fail gracefully with `ForeignSchemaValidationError` (typed domain exception)
- Phase ordering: A ships first, B and C in follow-up PRs. Do NOT block A on B/C.
- **DECIDED**: `NormalizedPlugin` is NOT versioned — internal type only, no schema versioning needed.

## Effort

HIGH — ~2–3 weeks total (A: ~1 week, B+C: ~1 week each).

## Commit (per phase)

```
feat(format-adapters): phase A — Cursor marketplace parser + NormalizedPlugin AST

Introduce ForeignMarketplaceParser port, NormalizedPlugin domain type,
and CursorMarketplaceAdapter. Extend PluginCatalogRepository with
loadForeign(). Adds emitFromNormalized() to cursor tool emitter.

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-1-format-adapters.md
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```
