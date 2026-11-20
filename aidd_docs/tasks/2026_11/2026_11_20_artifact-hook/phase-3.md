---
status: pending
---

# Instruction: aidd-context wired through its one Stop entry, docs, full checks

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs/ARCHITECTURE.md ✏️
├── scripts/__tests__/
│   ├── artifact-hook.test.js ✏️
│   └── memory-hook.test.js ✏️
└── plugins/aidd-context/hooks/
    ├── hooks.json ✏️
    └── memory.cjs ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | aidd-context `hooks/` installed per host in a temp folder, `TMPDIR` per test | hook ready | system |
| Happy path | PostToolUse writing a broken `.claude/agents/a.md`, `.claude/commands/c.md`, `aidd_docs/rules/x/r.md` and `.claude/skills/s/SKILL.md`, then Stop | one answer holding the AGENT, COMMAND, RULE and SKILL lines | system |
| Edge case | SessionStart, then a shell PostToolUse (no `files`) as `write-rule.cjs` runs, then Stop. `aidd_docs/rules/x/r.md` is broken with mtime after the reference (`fs.utimesSync`), and another broken rule has mtime before it | only `r.md`'s RULE finding is answered | system |
| Edge case | Stop where memory sync also reports a context file it could not sync | one answer holding both texts, never two | system |
| Edge case | `.cursor/rules/x.mdc`, `.github/agents/a.agent.md`, `.codex/prompts/p.toml` written | silent | system |
| Edge case | Stop with `stop_hook_active` after an artifact write | silent, mark consumed | system |
| Edge case | `memory-hook.test.js:137`: session start and Stop with no write | temp folder stays empty | system |
| Teardown | temp folders removed | none left | system |

## Tasks to do

### `1)` One Stop answer for aidd-context

> Memory and artifacts answer together, once.

1. In `memory.cjs` `atTurnEnd` (`:76-81`), take `require("./artifacts.cjs").atStop(event)` before the `stopActive` return, so the mark is consumed.
2. Join it with the memory text and answer once through `host.answer`. Both reads sit inside the existing try/catch (`runHook`, `:295-302`).
3. Add two entries to `hooks.json`, each with timeout 5. SessionStart runs `node ${CLAUDE_PLUGIN_ROOT}/hooks/artifacts.cjs start` (`AIDD Context: note turn start`); SessionStart entries never answer, so two are safe. PostToolUse, matcher `Write|Edit|Bash|Shell|bash|PowerShell`, runs `... artifacts.cjs mark` (`AIDD Context: check written artifacts`). Add no second Stop entry.

### `2)` Tests

> The merged answer and the context artifacts are proven per host.

1. Extend `artifact-hook.test.js` with the aidd-context rows of the Test Scope.
2. Extend `memory-hook.test.js` with the merged answer row. The existing no-state test stays green unchanged.

### `3)` Docs

> The hooks contract names what this feature adds, nothing more.

1. In `docs/ARCHITECTURE.md` Hooks, update rule 1 and the intro to name aidd-dev and aidd-pm, and rule 4 to name the `artifacts.cjs` concern (`mark`, `check`) and aidd-context's single Stop entry. In rule 7, name only the artifacts mark state; leave its stale memory text as it is.

### `4)` Contributor checks

> The repo is green.

1. `node scripts/check/run.cjs` prints nothing. If a generator reports a stale catalog, run `node scripts/check/run.cjs --fix`.
2. `node scripts/check/engine/sync.cjs --check` prints nothing.
3. `node --test 'scripts/__tests__/**/*.test.js'` passes (`lefthook.yml:42`, `cli-ci.yml:537`).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | a Stop after a broken agent write prints one `decision: block` whose reason holds the AGENT finding, and the memory text when it has one |
| 2 | the new tests pass on claude, codex, copilot, cursor, opencode and kilo adapters; `memory-hook.test.js` passes unchanged where it was |
| 3 | the Hooks section names the three plugins' artifact hook and the single Stop entry; `run.cjs` reports no DOC finding |
| 4 | the three commands exit 0 |
