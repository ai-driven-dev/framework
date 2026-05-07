# Part 3 — OpenCode tool support

> First-class OpenCode emitter + sync support. Complete the `opencode.ts` tool definition, add it to the 4-tool sync matrix (5th tool), and wire format adapter from Part 1 Phase D.

## Pre-requisites

- Part 2 (plugin symmetry) landed — emitter patterns established before adding a 5th tool
- Part 1 Phase D (OpenCode format adapter) — deferred, can be done in parallel if `NormalizedPlugin` AST exists
- `src/domain/tools/ai/opencode.ts` already exists (180 LOC) — audit it before writing code

## Goal

OpenCode is registered in the tool registry and `opencode.ts` exists, but locked decision #12 deferred the flat-mode completion (commands/rules/skills/agents all flattened into a single config file). This part:

1. Completes `opencode.ts` capability emitters following the flat-mode strategy
2. Adds OpenCode to the sync matrix (5×5 = 20 pairs: claude/cursor/copilot/codex/opencode)
3. Wires `plugin install --tool opencode` and `ai install opencode`
4. Adds Part 1 Phase D format adapter (OpenCode native marketplace ingestion)

OpenCode flat-mode strategy: all capabilities merged into `.opencode/config.json` using a stable section schema. Each capability type maps to a well-known JSON key.

## Architecture compliance

- `src/domain/tools/ai/opencode.ts` — implement all capability emitter methods, no stubs
- Flat-mode config path: `.opencode/config.json` (verify against OpenCode docs before coding)
- Each emitter method: ≤20 lines, pure path/content output, no I/O
- `EmitResult` discriminated union re-used from Part 2
- Domain pure: opencode.ts imports only domain types

### Flat-mode section schema (draft — verify against OpenCode docs)

```json
{
  "commands": [...],
  "rules": [...],
  "skills": [...],
  "agents": [...],
  "mcp": { "servers": {...} }
}
```

Open question: does OpenCode support hooks? If not, `emitHook()` returns `{ kind: "skipped"; reason: "opencode has no hook equivalent" }`.

## Steps

### A. Audit existing opencode.ts

- [ ] Read `src/domain/tools/ai/opencode.ts` (180 LOC) — identify which methods are stubs vs implemented
- [ ] Record actual gap list (update this file)
- [ ] Verify `.opencode/config.json` path is correct against OpenCode documentation

### B. Complete opencode.ts emitters

- [ ] `emitCommand()` — append command object to `.opencode/config.json` commands array
- [ ] `emitRule()` — append rule to `.opencode/config.json` rules array
- [ ] `emitSkill()` — append skill to `.opencode/config.json` skills array
- [ ] `emitAgent()` — append agent to `.opencode/config.json` agents array
- [ ] `emitHook()` — `{ kind: "skipped"; reason: "opencode has no hook equivalent" }` until confirmed
- [ ] `emitMcp()` — merge into `.opencode/config.json` mcp.servers object
- [ ] Each method: idempotency guard (section markers or key-based dedup)

### C. Add OpenCode to tool registry if not fully wired

- [ ] Confirm `opencode` appears in `src/domain/tools/registry.ts` with correct `ToolConfig`
- [ ] Confirm `ai install opencode` and `plugin install --tool opencode` route to opencode.ts
- [ ] Add `opencode` to any hardcoded tool list in commands that enumerate tools

### D. Extend sync matrix (20 pairs)

- [ ] Add opencode as source and target in `tests/harness/sync-matrix.test.ts`
- [ ] Add test fixture `tests/fixtures/opencode-format/sample-plugin/` with representative config
- [ ] 4 pairs added as source: opencode → {claude, cursor, copilot, codex}
- [ ] 4 pairs added as target: {claude, cursor, copilot, codex} → opencode

### E. Part 1 Phase D — OpenCode format adapter (if Part 1 landed)

- [ ] Create `src/infrastructure/adapters/opencode-marketplace-adapter.ts`
- [ ] Unit test: parse opencode marketplace JSON fixture
- [ ] Wire in `deps.ts`

## Tests

### Unit tests

- `tests/domain/tools/ai/opencode.unit.test.ts` — one describe per capability
  - Each implemented capability: assert output path + JSON content shape
  - Each skipped capability: assert `kind === "skipped"` with non-empty reason
  - Idempotency: emitting same capability twice → same result (no duplication)

### Integration tests

- `tests/application/use-cases/sync/opencode-sync.integration.test.ts` — in-memory FS, claude → opencode sync, assert `.opencode/config.json` written with expected content

### Harness extension

- Sync matrix: 8 new opencode rows (4 as source, 4 as target)
- Command matrix: `ai install opencode` row

## Acceptance criteria

- [ ] `pnpm test` green (including 8 new sync-matrix rows)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] `opencode.ts` has zero `throw new Error("not yet implemented")` stubs
- [ ] `ai install opencode` succeeds in a tmp project
- [ ] `ai sync --source claude --target opencode` writes `.opencode/config.json`
- [ ] `ai sync --source opencode --target claude` writes to `.claude/` correctly
- [ ] Sync matrix: all 20 pairs logged (8 new opencode pairs exit 0)
- [ ] Part 1 Phase D: `aidd plugin install --foreign-source opencode <url>` parses (if Part 1 landed)

## Manual validation

```bash
rm -rf /tmp/oc-test && mkdir /tmp/oc-test && cd /tmp/oc-test
aidd setup --source remote --yes
aidd ai install opencode

# Sync from claude to opencode
aidd plugin add ../claude-format/sample-plugin --tool claude
aidd ai sync --source claude --target opencode --force
cat .opencode/config.json && echo "OK: config written"

# Sync from opencode to claude
aidd ai sync --source opencode --target claude --force
ls .claude/commands/ && echo "OK: commands synced back"
```

## Risks / breaking changes

- OpenCode config schema may not be finalised — pin to a specific OpenCode version in fixtures
- Flat-mode merging into JSON requires `mergeJsonFile()` port method with array-aware strategy; confirm `MergeStrategy` supports array append
- Open question: OpenCode MCP format — same as `.mcp.json` or different? Document before implementing `emitMcp()`
- 20-pair sync matrix doubles harness runtime; consider parallelising fixture setup

## Effort

MEDIUM — ~3–5 days (audit + implementation + test fixtures).

## Commit

```
feat(opencode): complete emitter + add to 5-tool sync matrix

Implement all capability emitters in opencode.ts (flat-mode JSON config).
Wire opencode in tool registry, plugin install, and ai install commands.
Extend sync-matrix harness from 12 to 20 pairs (4 opencode-as-source +
4 opencode-as-target).

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-3-opencode.md
Depends on: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-2-plugin-symmetry.md
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```
