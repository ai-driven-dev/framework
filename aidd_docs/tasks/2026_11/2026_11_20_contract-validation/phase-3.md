---
status: pending
---

# Instruction: Skill and agent contracts

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/
│   └── aidd-context/
│       ├── CATALOG.md ✏️
│       └── skills/
│           ├── 04-skill-generate/
│           │   ├── actions/
│           │   │   └── 04-validate.md ✏️
│           │   ├── references/
│           │   │   └── skill-authoring.md ✏️
│           │   └── scripts/
│           │       ├── check-skill.cjs ❌
│           │       ├── contract.json ✅
│           │       ├── validate-skill.cjs ✅
│           │       ├── checks/ ✅
│           │       └── lib/ ✅
│           └── 06-agent-generate/
│               └── scripts/
│                   ├── contract.json ✅
│                   ├── validate-agent.cjs ✅
│                   └── lib/ ✅
└── scripts/
    └── __tests__/
        ├── check-skill.test.js ❌
        ├── scaffold-skill.test.js ✏️
        └── contract/
            ├── skill-contract.test.js ✅
            └── agent-contract.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | keep `check-skill.cjs` until parity holds | both engines callable | system |
| Happy path   | parity harness over every skill | same file, line and rule as `check-skill.cjs`, except its one known false positive | cli |
| Edge case    | description over 150 characters | SKILL-01 with the actual length | cli |
| Edge case    | `{{…}}` in prose outside assets | SKILL-15 | cli |
| Edge case    | raw agent template | flagged; a filled agent passes | cli |
| Teardown     | delete `check-skill.cjs` and its test | suite green | system |

## Tasks to do

### `1)` Skill contract

> `contract.json` holds every rule `check-skill.cjs` enforces today.

1. Port the prototype contract and its `checks/`, with SKILL-15 matching `{{…}}` and SKILL-01 on `max`.
2. Add `validate-skill.cjs`, the three-line wrapper, and run `sync.cjs`.
3. Prove parity, then delete `check-skill.cjs` and `check-skill.test.js`.

### `2)` Agent contract

> Agents get the same check from their template.

1. Port the prototype agent contract, without the no-bold rule.

### `3)` Callers and docs

> Nothing names `check-skill.cjs` any more.

1. Point `04-validate.md` and `scaffold-skill.test.js` at `validate-skill.cjs`.
2. Update `skill-authoring.md` (script name, R13 slot form).
3. Regenerate `plugins/aidd-context/CATALOG.md` with `scripts/summarize-plugin-catalogs.sh`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | parity harness reports zero findings only in one engine, apart from the known false positive |
| 2 | raw agent template flagged, filled one clean |
| 3 | `grep -r check-skill.cjs plugins scripts` finds nothing; scripts suite passes |
