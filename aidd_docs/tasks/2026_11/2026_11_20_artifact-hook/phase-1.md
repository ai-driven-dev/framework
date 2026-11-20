---
status: pending
---

# Instruction: Contracts declare their `scope`

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── scripts/
│   ├── check/engine/engine.cjs ✏️
│   └── __tests__/check/
│       ├── engine.test.js ✏️
│       └── skill-contract.test.js ✏️
└── plugins/
    ├── aidd-context/skills/
    │   ├── 04-skill-generate/scripts/
    │   │   ├── contract.json ✏️
    │   │   ├── lib/engine.cjs ✏️
    │   │   └── custom/sibling-plugin.cjs ✏️
    │   ├── 05-rule-generate/scripts/
    │   │   ├── contract.json ✏️
    │   │   └── lib/engine.cjs ✏️
    │   ├── 06-agent-generate/scripts/
    │   │   ├── contract.json ✏️
    │   │   └── lib/engine.cjs ✏️
    │   └── 07-command-generate/scripts/
    │       ├── contract.json ✏️
    │       └── lib/engine.cjs ✏️
    ├── aidd-dev/skills/
    │   ├── 01-plan/scripts/
    │   │   ├── contract.json ✏️
    │   │   └── lib/engine.cjs ✏️
    │   └── 02-implement/scripts/
    │       ├── contract.json ✏️
    │       └── lib/engine.cjs ✏️
    └── aidd-pm/skills/02-user-stories/scripts/
        ├── contract.json ✏️
        └── lib/engine.cjs ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | temp contract files written by `engine.test.js` | fixtures ready | system |
| Happy path | `loadContract` on a contract with `scope: [".claude/agents/*.md"]` | loads, `scope` kept | system |
| Edge case | `scope` is a string, holds a non-string, an absolute path or a `..` segment | `ContractError` naming `scope` | system |
| Edge case | SKILL-22 on a skill at `.claude/skills/x/SKILL.md` naming `aidd-dev:01-plan` | no finding; the same text under `plugins/aidd-pm/skills/x` still fires | system |
| Edge case | `node scripts/check/engine/sync.cjs --check` after the engine edit, before sync | names the 7 stale `lib/engine.cjs` copies, exit 1 | cli |
| Teardown | temp folders removed by the tests | none left | system |

## Tasks to do

### `1)` Engine accepts `scope`

> A contract names where its artifacts live in a user's project.

1. Add `scope` to `TOP_KEYS` (`engine.cjs:10`).
2. In `loadContract` (`engine.cjs:40-79`), fail unless `scope` is absent or an array of relative slash globs without `..`.
3. Export `globRegex` (`engine.cjs:20`) so the hook matches with the engine's own globs.

### `2)` Each contract declares its scope

> The seven contracts claim only the forms they can read.

1. `04-skill-generate`: `.claude/skills/*`, `.cursor/skills/*`, `.opencode/skills/*`, `.kilo/skills/*`, `.github/skills/*`, `.agents/skills/*` (hosts from `references/tool-write.md`).
2. `06-agent-generate`: `.claude/agents/*.md`. `07-command-generate`: `.claude/commands/*.md`.
3. `05-rule-generate`: `aidd_docs/rules/*/*.md` (`write-rule.cjs:155`).
4. `01-plan` and `02-implement`: `aidd_docs/**`.
5. `02-user-stories`: `aidd_docs/backlog/stories/*.md` (`references/persistence.md:15`).

### `3)` SKILL-22 judges plugin skills only

> A user's skill may name any plugin's skill.

1. In `sibling-plugin.cjs`, return no finding unless the folder above `skills/` sits directly under `plugins/`.

### `4)` Engine copies resynced

> The vendored copies match the source.

1. Run `node scripts/check/engine/sync.cjs`, then `--check`, which prints nothing.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `engine.test.js` loads a scoped contract and rejects each malformed `scope` with a `ContractError` |
| 2 | each of the seven contracts loads, and `node scripts/check/run.cjs` prints nothing new |
| 3 | `skill-contract.test.js` shows SKILL-22 silent under `.claude/skills/` and still firing under `plugins/*/skills/` |
| 4 | `node scripts/check/engine/sync.cjs --check` exits 0 |
