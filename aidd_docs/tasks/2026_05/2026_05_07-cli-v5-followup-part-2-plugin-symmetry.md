# Part 2 — Plugin re-translation symmetry

> Fill capability translation gaps in the ai sync matrix. Every tool emitter handles every `NormalizedCapability` bidirectionally: commands, rules, skills, agents, hooks, mcp.

## Pre-requisites

- Current sync matrix documented: `2026_05_06-cli-v5-cleanup-sync-matrix.md`
- Part 1 (format adapters) recommended — `NormalizedPlugin` AST needed for full emitter extension
- Part 1 Phase A can be done in parallel if `NormalizedPlugin` types are stubbed first

## Goal

The current sync matrix shows:

| Source | Target | commands | rules | skills | agents | hooks | mcp |
|---|---|---|---|---|---|---|---|
| claude | cursor | Translated | No fixture tested | No fixture tested | No fixture tested | Gap | Gap |
| claude | copilot | Gap | Gap | Gap | Gap | Gap | Gap |
| claude | codex | Gap | Gap | Gap | Gap | Gap | Gap |
| cursor | claude | Translated | No fixture tested | No fixture tested | No fixture tested | n/a | Gap |
| copilot/codex | any | Gap | Gap | Gap | Gap | n/a | Gap |

Goal: each tool emitter in `src/domain/tools/ai/<tool>.ts` correctly translates every capability it can support. Gaps become either:

1. **Implemented** — translation rule documented + unit tested
2. **Explicitly unsupported** — `EmitResult` with `kind: "skipped"` + reason string (not a silent no-op)

## Architecture compliance

- Tool emitter files: `src/domain/tools/ai/{claude,cursor,copilot,codex}.ts`
- Each capability translation is a private method ≤20 lines
- No I/O in emitters — pure path/content computation
- `EmitResult` discriminated union: `{ kind: "written"; path: string } | { kind: "skipped"; reason: string } | { kind: "merged"; path: string }`
- `EmitResult` lives in `src/domain/models/emit-result.ts` (if not already)
- Domain pure: no adapter imports inside `domain/tools/ai/`

### Translation rules documented

For each tool × capability pair:

| Tool | Capability | Strategy |
|---|---|---|
| cursor | commands | `.cursor/rules/<name>.mdc` with frontmatter |
| cursor | rules | `.cursor/rules/<name>.mdc` |
| cursor | skills | `.cursor/rules/<name>.mdc` (wrapped) |
| cursor | agents | `.cursor/agents/<name>.mdc` |
| cursor | hooks | skipped — no cursor hook equiv |
| cursor | mcp | `.cursor/mcp.json` merge |
| copilot | commands | `.github/copilot-instructions.md` append section |
| copilot | rules | `.github/copilot-instructions.md` append section |
| copilot | skills | `.github/copilot-instructions.md` append section |
| copilot | agents | skipped — no copilot agent equiv in current spec |
| copilot | hooks | skipped |
| copilot | mcp | skipped — copilot MCP is workspace-level, not plugin-level |
| codex | commands | `AGENTS.md` append section |
| codex | rules | `AGENTS.md` append section |
| codex | skills | `AGENTS.md` append section |
| codex | agents | `AGENTS.md` append section |
| codex | hooks | skipped |
| codex | mcp | skipped — codex MCP deferred |

**DECIDED**: research step — verify Copilot agents spec at https://code.visualstudio.com/docs/copilot/customization/agent-plugins BEFORE implementing emitter. Document findings in commit body.

## Steps

### A. Audit existing emitter methods

- [ ] Read `src/domain/tools/ai/cursor.ts` — list which capabilities return real content vs stub
- [ ] Read `src/domain/tools/ai/copilot.ts` — same
- [ ] Read `src/domain/tools/ai/codex.ts` — same
- [ ] Read `src/domain/tools/ai/claude.ts` — baseline (source of truth)
- [ ] Record gap matrix in this file (update table above with actual gaps found)

### B. Add test fixtures per capability per tool

- [ ] `tests/fixtures/claude-format/sample-plugin/` — extend with rules/, skills/, agents/, hooks/ subdirs if missing
- [ ] `tests/fixtures/cursor-format/sample-plugin/` — add rules/ subdir
- [ ] `tests/fixtures/copilot-format/sample-plugin/` — create if missing
- [ ] `tests/fixtures/codex-format/sample-plugin/` — create if missing

### C. Implement cursor emitter gaps

- [ ] `emitRule()` — `.cursor/rules/<name>.mdc`
- [ ] `emitSkill()` — `.cursor/rules/<name>.mdc` (wrapped with skill frontmatter marker)
- [ ] `emitAgent()` — `.cursor/agents/<name>.mdc`
- [ ] `emitHook()` — return `{ kind: "skipped"; reason: "cursor has no hook equivalent" }`
- [ ] `emitMcp()` — merge into `.cursor/mcp.json`

### D. Implement copilot emitter gaps

- [ ] `emitCommand()` — append to `.github/copilot-instructions.md`
- [ ] `emitRule()` — append to `.github/copilot-instructions.md`
- [ ] `emitSkill()` — append to `.github/copilot-instructions.md`
- [ ] `emitAgent()` — `{ kind: "skipped"; reason: "copilot agent equiv deferred" }` until spec confirmed
- [ ] `emitHook()`, `emitMcp()` — `{ kind: "skipped"; reason: "..." }`

### E. Implement codex emitter gaps

- [ ] `emitCommand()` — append to `AGENTS.md`
- [ ] `emitRule()` — append to `AGENTS.md`
- [ ] `emitSkill()` — append to `AGENTS.md`
- [ ] `emitAgent()` — append to `AGENTS.md`
- [ ] `emitHook()`, `emitMcp()` — `{ kind: "skipped"; reason: "..." }`

### F. Update sync-matrix verification test

- [ ] Extend `tests/harness/sync-matrix.test.ts` with per-capability assertions
- [ ] Each translated capability verifies the output file at expected path
- [ ] Each skipped capability verifies `EmitResult.kind === "skipped"` with non-empty reason

## Tests

### Unit tests (one file per emitter)

- `tests/domain/tools/ai/cursor.unit.test.ts` — one describe per capability, assert output path + content shape
- `tests/domain/tools/ai/copilot.unit.test.ts`
- `tests/domain/tools/ai/codex.unit.test.ts`
- For skipped capabilities: assert `kind === "skipped"` and `reason` is non-empty string

### Integration tests

- Extend existing `tests/application/use-cases/sync/` — end-to-end sync with in-memory FS; assert files written at correct paths for each capability

### No new E2E tests — existing sync-matrix harness extended in step F

## Acceptance criteria

- [ ] `pnpm test` green
- [ ] `pnpm typecheck` clean
- [ ] `pnpm biome check` clean
- [ ] No capability emitter method returns `undefined` or empty string silently — either `EmitResult` written or `EmitResult` skipped with reason
- [ ] `tests/harness/sync-matrix.test.ts` covers all capability × tool pairs
- [ ] Zero skipped entries remain in sync-matrix test without an explicit `reason` string
- [ ] `ai sync --source claude --target copilot` writes to `.github/copilot-instructions.md` for commands/rules/skills
- [ ] `ai sync --source claude --target codex` writes to `AGENTS.md` for commands/rules/skills/agents

## Manual validation

```bash
# Claude → Copilot commands/rules sync
rm -rf /tmp/sym-test && mkdir /tmp/sym-test && cd /tmp/sym-test
aidd setup --source remote --yes
aidd plugin add ../claude-format/sample-plugin --tool claude
aidd ai sync --source claude --target copilot --force
cat .github/copilot-instructions.md | grep "greet" && echo "OK: command synced"

# Claude → Codex agents sync
aidd ai sync --source claude --target codex --force
cat AGENTS.md | grep "greet" && echo "OK: agent synced"
```

## Risks / breaking changes

- Appending to `copilot-instructions.md` / `AGENTS.md` requires idempotency: re-sync must not duplicate sections. Implement section markers (HTML comments or header guards).
- **DECIDED**: research step — verify `copilot-instructions.md` size limit during the spec research phase (before implementing emitter). Document finding in commit body if discovered.
- MCP translation for cursor (`.cursor/mcp.json`) is a JSON merge — must use `mergeJsonFile()` port method. Verify merge strategy does not clobber existing user MCP entries.

## Effort

MEDIUM — ~1 week.

## Commit

```
feat(emitters): fill capability translation gaps — cursor/copilot/codex

Complete bidirectional capability translation for all tool emitters:
- cursor: rules, skills, agents implemented; hooks/mcp skipped with reason
- copilot: commands/rules/skills append to copilot-instructions.md
- codex: commands/rules/skills/agents append to AGENTS.md

All skipped capabilities return EmitResult{ kind: "skipped", reason }.
Sync-matrix harness extended per-capability per-tool.

Refs: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-2-plugin-symmetry.md
Depends on: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-part-1-format-adapters.md (NormalizedPlugin AST)
Master: aidd_docs/tasks/2026_05/2026_05_07-cli-v5-followup-master.md
```
