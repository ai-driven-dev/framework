---
status: pending
---

# Instruction: Contracts at turn end

## Architecture projection

```txt
.
└── plugins/
    └── aidd-ui/
        ├── hooks/
        │   ├── aidd-ui.cjs ✏️
        │   ├── artifacts.cjs ✅
        │   ├── hooks.json ✏️
        │   └── lib/
        │       └── contracts/ ✅
        └── skills/
            └── 03-foundations/
                └── scripts/
                    ├── contract.json ✅
                    └── custom/ ✅
```

## Test Scope

| Scenario   | Action                                         | Observable outcome                         | Actor  |
| ---------- | ---------------------------------------------- | ------------------------------------------ | ------ |
| Setup      | a Kairos copy with a session started           | the baselines are recorded                 | system |
| Happy path | a turn writes a record that breaks a rule      | one Stop answer names the rule once        | system |
| Edge case  | a turn writes only code with a colour literal  | the hook still holds the turn              | system |
| Edge case  | Stop on the Kairos copy                        | it answers within the 5 s timeout          | system |

## Tasks to do

### `1)` Contracts

> Each skill's single-file rules run as its contract; the cross-file ones as one folder contract on `aidd_docs/ui`.

1. Write each contract, its custom checks and its `validate-<kind>.cjs`.
2. Run `node scripts/check/engine/sync.cjs`.

### `2)` Wiring

> One Stop entry answers for both the hook and the contracts.

1. Add the start and mark entries of `artifacts.cjs` to `hooks.json`.
2. Relay `artifacts.cjs` from `aidd-ui.cjs` at Stop, merging both answers with no rule twice.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `node scripts/check/engine/sync.cjs --check` exits 0 |
| 2    | a Stop on the Kairos copy answers once, within 5 s, with each rule named once |
