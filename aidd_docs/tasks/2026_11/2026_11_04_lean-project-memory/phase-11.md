---
status: pending
---

# Instruction: One payload converter, shared by the bridges and a shim

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── cli/
    ├── assets/hooks-runtime/
    │   ├── convert.cjs ✅
    │   └── shim.cjs ✅
    ├── src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.ts ✏️
    ├── src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.ts ✏️
    ├── src/contexts/tools/domain/formats/hooks-merge.ts ✏️
    └── tests/contexts/tools/hooks-runtime.unit.test.ts ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | phase 8's 24 payload fixtures | real host input | system |
| Happy path | each fixture through `convert.cjs` | Claude's payload; the hook's Claude answer turned into the host's key | system |
| Edge case | a Codex or Copilot `apply_patch` touching three files | three Claude `Edit` payloads, the hook run three times, answers joined | system |
| Edge case | garbage, empty stdin, an unknown event | exit 0, nothing printed | system |
| Edge case | a Claude Code install | no shim: the command is the plugin's own | system |
| Edge case | a Codex payload through the shim into aidd-telemetry's hooks | still told as Codex by its `transcript_path`, same records as before; a new e2e case drives the shim, since `telemetry-journey.e2e.test.ts` calls the hooks directly | system |
| Edge case | a host that drops a level 2 answer | the converter answers at level 1 there | system |

## Tasks to do

### `1)` The converter

> One real module, tested as code, not template strings.

1. `convert.cjs`, Node built-ins only: host detected from the payload, Claude's fields added without dropping the host's, answer to the host's key, `AIDD_HOOK_HOST` set; tests first on every fixture.
2. The OpenCode and Kilo bridges call it instead of their inline conversion; their command parsing shares one copy.

### `2)` The shim

> Codex, Copilot and Cursor run every hook through the converter.

1. `shim.cjs <script> [args]`: reads stdin, converts, runs the script, converts its answer.
2. The engine wraps the command for descriptors whose runtime is `command` and host is not Claude Code; the build copies `assets/hooks-runtime/` into each distribution's hooks folder.

### `3)` Stated costs

> Said in the PR and the changelog.

1. One extra Node start per hook outside Claude Code; Codex asks to trust the changed hook commands once.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | every fixture converts both ways; the bridges hold no conversion of their own; `jscpd:profiles` baseline empty |
| 2 | goldens differ only by the wrapped command on Codex, Copilot and Cursor; `pnpm smoke` passes; `pnpm smoke:real` passes on Codex, Copilot and Cursor |
| 3 | the cost lines are in the PR body |
