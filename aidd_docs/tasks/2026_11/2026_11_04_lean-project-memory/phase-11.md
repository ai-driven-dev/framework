---
status: pending
---

# Instruction: One host adapter per tool, chosen at build time

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── cli/
│   ├── assets/hooks-runtime/
│   │   ├── host-claude.cjs ✅
│   │   ├── host-codex.cjs ✅
│   │   ├── host-copilot.cjs ✅
│   │   ├── host-cursor.cjs ✅
│   │   ├── host-opencode.cjs ✅
│   │   └── host-kilo.cjs ✅
│   ├── src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.ts ✏️
│   ├── src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.ts ✏️
│   ├── src/contexts/tools/domain/formats/hooks-descriptor.ts ✏️
│   └── tests/contexts/tools/hooks-runtime.unit.test.ts ✅
├── plugins/*/hooks/lib/host.cjs ✅
└── scripts/check-hook-rule-copies.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | phase 8's payload fixtures, one per host and event | real host input | system |
| Happy path | each fixture read by its host's adapter | the same neutral event; `answer` writes the host's own key | system |
| Edge case | a Codex or Copilot `apply_patch` touching three files | one event listing three files | system |
| Edge case | garbage, empty stdin, an unknown event | `readEvent` returns nothing, exit 0, nothing printed | system |
| Edge case | any install | the hook command is unchanged: no wrapper, no extra process | system |
| Edge case | a Codex payload into aidd-telemetry's hooks | still told as Codex, same records as before | system |
| Edge case | a host that drops a level 2 answer (Cursor) | its adapter answers at level 1 | system |

## Tasks to do

### `1)` The adapters

> A hook speaks to one neutral interface; each tool's translation is a file the build puts in place.

1. One adapter per host, Node built-ins only, the same exports: `readEvent()` returns `{ host, event, files: [{ path, content? }], command?, sessionId, cwd, raw }` or nothing on garbage; `answer({ level, text })` writes the host's key, level 2 falling back to level 1 where the host drops it; `continueTurn(text)` for Stop. Tests first on every fixture.
2. `host-claude.cjs` is copied into every plugin's `hooks/lib/host.cjs`, so the plugin tree runs as is on Claude Code; `check-hook-rule-copies.js` holds those copies identical to the asset.
3. The build replaces `hooks/lib/host.cjs` with the target's adapter on every other route; the descriptor's runtime field arrives here, with this first reader.
4. The OpenCode and Kilo bridges pass their own arguments to the script; their adapter reads them, and the bridges hold no conversion of their own; their command parsing shares one copy.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | every fixture reads to the expected event and answers in the host's key; every distribution's `hooks/lib/host.cjs` equals its target's adapter (phase 8 fixtures show it); hook commands and goldens unchanged except the adapter file; the bridges hold no conversion; `jscpd:profiles` baseline empty; `pnpm smoke` passes; `pnpm smoke:real` passes on Codex, Copilot and Cursor |
