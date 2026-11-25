---
status: pending
---

# Instruction: Ingest under the contract

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-telemetry/hooks/
│   ├── hooks.json         ✏️
│   ├── ledger.cjs         ✅
│   ├── catch-up.cjs       ❌
│   └── lib/
│       └── hook-io.cjs    ❌
└── scripts/__tests__/
    └── aidd-telemetry-hooks.test.js ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | consenting clone, a shim `aidd` on `PATH` that records its arguments | ready state | system |
| Happy path | `ledger.cjs ingest` gets a SessionStart payload | the shim ran once with `telemetry ingest --quiet`, nothing printed, exit 0 | system |
| Edge case  | no `aidd` on `PATH` | nothing printed, exit 0 | system |
| Edge case  | clone not consenting, or a payload of another tool | the shim never ran | system |
| Edge case  | malformed or empty stdin | nothing printed, exit 0 | system |
| Edge case  | consent key turned off by hand | the open interval is closed, as `catch-up.cjs` did | system |
| Teardown   | remove the temp clone, shim and telemetry dir | baseline restored | system |

## Tasks to do

### `1)` One entry per concern

> The ingest reads its event through `lib/host.cjs` and keeps doing only the ingest.

1. Move the Codex and Claude catch-up tests to `ledger.cjs ingest`, see them fail.
2. Create `ledger.cjs` from `catch-up.cjs`: `readEvent()`, the guard of `lib/context.cjs` on `event.raw`, `aidd telemetry ingest --quiet` through `lib/aidd.cjs`, no answer.
3. Delete `catch-up.cjs`, and `lib/hook-io.cjs` once no hook requires it.

### `2)` Wire it

> `hooks.json` names the ingest by concern and goal.

1. SessionStart async entry `node ${CLAUDE_PLUGIN_ROOT}/hooks/ledger.cjs ingest`, `statusMessage: "AIDD Telemetry: update the measurement ledger"`, timeout kept at 120 s.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | every Test Scope row passes; nothing under `plugins/aidd-telemetry/hooks` requires `hook-io.cjs` |
| 2    | `hooks.json` has exactly two SessionStart entries: `task.cjs remind` and `ledger.cjs ingest` |
