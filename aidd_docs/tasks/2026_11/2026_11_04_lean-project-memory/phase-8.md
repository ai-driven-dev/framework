---
status: in-progress
---

# Instruction: CLI characterization: pin what every route writes today

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── scripts/__tests__/fixtures/hook-payloads/ ✅
└── cli/tests/contexts/tools/hooks-routes.integration.test.ts ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | the plugins with hooks at the base head | aidd-context and aidd-telemetry | system |
| Happy path | each route on each tool: native build, flat translate, `aidd plugin install`, `plugin remove`, `clean` | the hook files written and removed, recorded as expected output | system |
| Edge case | a second `plugin install` of the same plugin | the entries it leaves, recorded as they are today | system |
| Edge case | real payloads captured per host and event | committed with their paths scrubbed | system |

## Tasks to do

### `1)` Routes pinned

> Any change of output in later phases is seen and named.

1. `hooks-routes.integration.test.ts`: for each tool and route, the exact hook files and their content, written from today's behaviour.
2. The goldens of `cli/tests/golden/` stay as they are; this test pins what they do not, `plugin install` and the removals.

### `2)` Payloads captured

> The converter of phase 11 is tested on what hosts really send.

1. Reuse the PostToolUse payloads #1146's campaign logged under `~/skill-tests/memhook/` for the six hosts.
2. SessionStart, Stop and a shell-command PostToolUse are not established there: capture them in throwaway homes under `~/skill-tests/`, after the user approves the runs and their cost; the same runs record whether a PostToolUse `decision: block` reaches the model on each host, filling the contract's untested row.
3. Run the native Copilot tree once to learn whether Copilot accepts its nested hooks shape; record the answer in the contract.
4. Scrub paths and session ids; one JSON file per host and event under `scripts/__tests__/fixtures/hook-payloads/`, read by the CLI tests and the hook tests alike, as `fixtures/telemetry-bindings/` is.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | the test passes on the base head and fails when any route's output changes by one byte |
| 2 | one fixture per host and event, none holding a local path or a real session id (`scripts/check-no-local-paths.js`); the level 2 row and the Copilot answer written in `hook-contract.md` |
