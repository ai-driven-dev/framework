---
status: done
---

# Instruction: Write hook

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-context/hooks/
│   ├── hooks.json ✏️
│   └── memory-hook.js ✅
└── scripts/__tests__/
    └── memory-hook.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | a temp project with a bank holding one breach per rule | files on disk | system |
| Happy path   | pipe a Claude Code `PostToolUse` payload naming a memory file with breaches | stdout holds one JSON `hookSpecificOutput.additionalContext` with that file's problems, exit 0 | system |
| Edge case    | a payload naming a file outside `aidd_docs/memory/` | no output, exit 0, the bank is never read | system |
| Edge case    | a Codex `apply_patch` payload, its patch paths relative to `cwd`, and a Copilot payload with `tool_result` | the same problems, Copilot's as a top-level `additionalContext` | system |
| Edge case    | a Cursor payload: `tool_name` `Write`, absolute `tool_input.file_path`, `workspace_roots`, `cursor_version`, no `cwd` | the same problems, root taken from `workspace_roots` | system |
| Edge case    | invalid JSON, a missing file, an engine that throws | no output, exit 0 | system |
| Edge case    | a payload with no path at all, as any non-write tool or an unknown host sends | no output, exit 0, no file read | system |
| Edge case    | the engine and the hook sources | they require only `node:fs` and `node:path`: no child process, network or temp file | system |
| Edge case    | a file with more than ten problems | ten lines, errors first, then one line naming the command for the rest | system |
| Edge case    | a clean memory file | no output, exit 0 | system |
| Teardown     | remove the temp project | baseline restored | system |

## Tasks to do

### `1)` Hook

> Hands a written memory file's problems back to the model, and never stands in the way.

1. Read the payload; take the written paths from `tool_input.file_path`, `tool_input.path`, or a patch's `*** Add|Update File:` lines; resolve the project root from `cwd`, else `workspace_roots[0]`, else `CURSOR_PROJECT_DIR` or `CLAUDE_PROJECT_DIR`, else the process directory.
2. Keep only paths under `aidd_docs/memory/` ending in `.md`, other than `README.md`; with none, exit 0 before any read of the bank.
3. Lint each with the engine; print at most ten problem lines, errors first, plus one line naming `node memory-lint.js` for the rest.
4. Print `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":…}}`, or `{"additionalContext":…}` for a Copilot payload; exit 0 whatever happens.

### `2)` Wiring

> The hook runs after every write, beside the memory sync.

1. Add a `PostToolUse` group, matcher `Write|Edit|MultiEdit`, command `node ${CLAUDE_PLUGIN_ROOT}/hooks/memory-hook.js`, timeout 5, to `plugins/aidd-context/hooks/hooks.json`, the `SessionStart` group unchanged.

### `3)` Contributor checks

> The repository's own gates pass.

1. Run `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`.
2. Run `pnpm exec lefthook run pre-commit`, which regenerates `docs/CATALOG.md`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | every payload shape yields the written file's problems, nothing else ever produces output, the hook exits 0 in every scenario, and its sources require nothing beyond `node:fs` and `node:path` |
| 2 | `hooks.json` declares both groups, and both catalogs list the new hook after the pre-commit |
| 3 | the scripts suite and the pre-commit pass |
