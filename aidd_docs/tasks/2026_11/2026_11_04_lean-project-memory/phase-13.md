---
status: pending
---

# Instruction: The memory hook on the contract

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-context/hooks/
│   ├── hooks.json ✏️
│   ├── memory.cjs ✅
│   ├── memory-hook.cjs ❌
│   ├── memory-lint.cjs ❌
│   ├── update_memory.js ❌
│   └── lib/
│       ├── memory-rules.cjs ✏️
│       └── paths-exist.cjs ✅
├── plugins/aidd-context/skills/02-project-memory/actions/04-sync.md ✏️
├── plugins/aidd-context/skills/10-learn/actions/05-sync.md ✏️
├── scripts/check-context-reference-form.js ✏️
├── scripts/check-hook-rule-copies.js ✅
└── scripts/__tests__/
    ├── memory-hook.test.js ✏️
    └── memory-rules-banks.test.js ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | the four real banks (framework root, `cli/`, gouvernail, kairos-app) | real data | system |
| Happy path | a write leaving `{{x}}` in `vcs.md` | `decision: block` with `vcs.md:<line> M3 "{{x}}" => <fix>` | system |
| Edge case | a 31-word prose line | `additionalContext` warning, no block | system |
| Edge case | `memory/kpi/x.md` written | level 2, the move named | system |
| Edge case | a write in the bank while `architecture.md` is missing | level 1 line naming the missing files | system |
| Edge case | session start with `aidd_docs/ui/` and `aidd_docs/pm/` present | the memory block lists both folders; nothing staged in git; nothing printed | system |
| Edge case | a write outside `aidd_docs/` | exit 0 before reading anything else | system |

## Tasks to do

### `1)` One entry

> One file per concern, `hook`, `check` and `sync`.

1. `memory.cjs hook|check|sync` replaces `memory-hook.cjs`, `memory-lint.cjs` and `update_memory.js`; `sync` drops `git add`.
2. Rename every reference: `04-sync.md`, `10-learn/actions/05-sync.md`, `sync-arguments.md`, `scripts/check-context-reference-form.js`, `aidd_docs/memory/coding-assertions.md`, `codebase-map.md`, the catalogs, the CLI tests and fixtures.
3. Delete the hook's own Codex and Copilot payload reading: phase 11 hands it Claude's payload on every host.

### `2)` Levels

> Each rule at the level phase 1 and the four banks justify.

1. Level 2: M3, M4 through `lib/paths-exist.cjs`, a file outside `memory/`'s root, `internal/` and `external/`.
2. M7 at level 2 only if `memory-rules-banks.test.js` counts zero false hits on the four banks; else level 1.
3. Level 1: M1, M2, M5, M6, a missing always-written file.
4. Output per the contract's format: every error, warnings capped at the number phase 1 measured.

### `3)` Block and layout

> The block lists what other plugins own; context owns the layout.

1. `sync` lists each folder of `aidd_docs/` that exists on disk and is not memory's (`ui/`, aidd-pm's, `tasks/`…), by convention: a folder present is listed, nothing reads which plugins are installed.
2. `scripts/check-hook-rule-copies.js` holds every copy of `paths-exist.cjs` identical.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | no file names the three old scripts; the reference-form check passes; `git status` unchanged after a session start |
| 2 | each level 2 rule has zero hits on the four banks; each scenario above answers as stated, through the converter on six hosts |
| 3 | the block lists ui and pm folders when present; the copies check fails on a one-byte change |
