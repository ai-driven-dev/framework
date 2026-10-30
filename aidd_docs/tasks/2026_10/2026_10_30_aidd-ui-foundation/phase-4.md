---
status: pending
---

# Instruction: Entry, hook and docs

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs/
│   └── CATALOG.md ✏️
├── plugins/aidd-ui/
│   ├── CATALOG.md ✏️
│   ├── README.md ✏️
│   └── hooks/
│       ├── hooks.json ✅
│       ├── ui-hook.cjs ✅
│       └── validate-ui.cjs ✅
└── scripts/__tests__/
    └── aidd-ui-validate.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `writeProject(tmp)` | the valid project | system |
| Happy path   | `node plugins/aidd-ui/hooks/validate-ui.cjs tmp` | `VALID`, exit 0 | cli |
| Edge case    | E1: the same on a project without `aidd_docs/ui/` | nothing printed, exit 0 | cli |
| Edge case    | E2: one mutation from each of phases 1, 2 and 3 | one `✗ <file>: <message>` line each, exit 1 | cli |
| Edge case    | E3: `ui-hook.cjs` with a PostToolUse payload, `cwd` = `tmp`, `tool_input.file_path` under `aidd_docs/ui/`, after a mutation | the `✗` lines on stderr, exit 2 | system |
| Edge case    | E3: the same with `file_path` under `src/ui/` | the `✗` lines on stderr, exit 2 | system |
| Edge case    | E3: the same with `file_path` outside `aidd_docs/ui/` and every code root | silent, exit 0 | system |
| Edge case    | E3: the same on a valid project | silent, exit 0 | system |
| Edge case    | E4: SessionStart payload on a project with failures | stdout: the count then the `✗` lines, exit 0 | system |
| Edge case    | E4: SessionStart on a project without `aidd_docs/ui/` | silent, exit 0 | system |
| Edge case    | E5: PostToolUse payload without `tool_input.file_path`, as a host without matcher sends; empty or non-JSON stdin | silent, exit 0 | system |
| Teardown     | remove `tmp` | no file left | system |

## Tasks to do

### `1)` Manual entry

> One command runs every check.

1. `validate-ui.cjs`: root from the argument, else the working directory; `load`; nothing and exit 0 when `null`; else run `records`, `history`, `tokens`, `renders`, `code` in that order; print `VALID` or one `✗ <path relative to the root>: <message>` per problem; exit 1 on any; export `validate(root)` returning the problems.

### `2)` Hook entry

> The same checks on every write and at session start.

1. `ui-hook.cjs`: read stdin JSON; anything else exits 0 silently; root from `cwd`.
2. PostToolUse: run `validate(root)` only when `tool_input.file_path` is under `aidd_docs/ui/` or a `code-roots` prefix; on problems write the `✗` lines to stderr and exit 2.
3. SessionStart: on problems write `aidd-ui: <n> problems` then the `✗` lines to stdout; always exit 0.
4. Any thrown error exits 0 silently: a broken check never blocks a session.
5. `hooks.json`: `SessionStart` and `PostToolUse` matching `Write|Edit|MultiEdit`, each `node ${CLAUDE_PLUGIN_ROOT}/hooks/ui-hook.cjs`.

### `3)` Tests

> Each entry has its mutation.

1. `aidd-ui-validate.test.js`: one test per Test Scope row, spawning `node` with the payload on stdin.

### `4)` Docs

> The README and catalogs match the tree.

1. `plugins/aidd-ui/README.md`: status from `plugin.json`'s version; the `aidd_docs/ui/` tree and each record's keys; the hand command `node <plugin>/hooks/validate-ui.cjs`; the limits: no `node`, no feedback in the turn outside Claude Code, Codex runs the hook once trusted, no composite token shape, no non-web code literal, no unit literal in script files, a word of hex letters after `#` counts as a colour; fixed widths on text and long translations are for the audit.
2. Run `node scripts/sync-generated-docs.mjs` and `sh scripts/summarize-plugin-catalogs.sh`.

### `5)` Contributor checks

> The tree passes what a pull request requires.

1. Run `make check` (`CONTRIBUTING.md`) and `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` (`aidd_docs/memory/testing.md`); fix until both exit 0.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the valid project prints `VALID`; each phase's mutation prints its line and exits 1 |
| 2 | each Test Scope hook row gives its exit code and output |
| 3 | reverting the path filter, the exit 2 or the silent catch turns its own test red |
| 4 | the README holds the tree, the command and every limit; `docs/CATALOG.md` lists `hooks/ui-hook.cjs` under `SessionStart` and `PostToolUse`; `plugins/aidd-ui/CATALOG.md` lists the hook files |
| 5 | both commands exit 0 |
