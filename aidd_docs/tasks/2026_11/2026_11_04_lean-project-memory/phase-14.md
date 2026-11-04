---
status: pending
---

# Instruction: The contract written where it lasts

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs/ARCHITECTURE.md ✏️
└── plugins/aidd-context/skills/08-hook-generate/
    ├── actions/01-capture-hook.md ✏️
    └── references/hook-authoring.md ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | `hook-contract.md` approved | the source | system |
| Happy path | a contributor reads `docs/ARCHITECTURE.md` | the levels, the placing questions, the rules, what the CLI carries | human |
| Edge case | a user asks `08-hook-generate` for a hook | asked whether it should inform or stop the turn ending; no framework rule imposed on the user's tool or language | cli |

## Tasks to do

### `1)` Framework contract

> Binding on the framework's own hooks.

1. A `Hooks` section in `docs/ARCHITECTURE.md` from `hook-contract.md` sections 2 to 6, no sentence repeated from elsewhere (`scripts/check-doc-duplication.js`).

### `2)` Users stay free

> The levels are a question, never a rule.

1. `01-capture-hook.md` asks the intent (inform, require a fix, stop the turn ending) and maps it to the user's tool mechanism; `hook-authoring.md` lists the three as options.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | the section passes the pre-commit; `hook-contract.md` stays in the task folder as the record |
| 2 | no action of `08-hook-generate` states a framework constraint as required |
