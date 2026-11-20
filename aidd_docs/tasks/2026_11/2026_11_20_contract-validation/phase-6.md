---
status: pending
---

# Instruction: Repository run, baseline and CI

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── validate.config.json ✅
├── .github/
│   └── workflows/
│       └── validate.yml ✏️
├── aidd_docs/
│   └── memory/
│       └── testing.md ✏️
└── scripts/
    ├── contract/
    │   ├── repo.json ✅
    │   ├── plugin-schema.json ✅
    │   ├── run.cjs ✅
    │   └── checks/ ✅
    └── __tests__/
        └── contract/
            ├── repo-contract.test.js ✅
            └── run.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `validate.config.json` maps globs to contracts, baseline recorded on today's tree | config ready | system |
| Happy path   | `node scripts/contract/run.cjs` on today's tree | exit 0 | cli |
| Edge case    | a skill description grows past 150 characters | exit 1, only that new finding | cli |
| Edge case    | a plugin manifest omits a skill folder, lists a missing one, or differs from the marketplace | repo finding | cli |
| Edge case    | a raw `plugin.json` skeleton (empty skills, placeholder name) then a real manifest | skeleton flagged, real manifest clean | cli |
| Edge case    | a vendored engine copy edited | exit 1 from the sync check | cli |
| Teardown     | revert fixtures | baseline restored | system |

## Tasks to do

### `1)` Repo contract

> `plugin.json` against its skill folders and the marketplace.

1. Port the prototype plugin schema and coherence check as `repo.json`, without the description length cap.

### `2)` Repository run

> One command validates the whole tree, minus archived plans.

1. Write `validate.config.json`: glob to contract, and the baseline of today's findings.
2. Write `run.cjs`: run each mapped contract and `sync.cjs --check`, report only findings absent from the baseline, `--update-baseline` to record.
3. Record the baseline.

### `3)` CI and docs

> CI blocks new findings only.

1. Add a contracts job to `.github/workflows/validate.yml` running `run.cjs`.
2. Update the strategy row of `aidd_docs/memory/testing.md`.
3. Run the contributor checks: `make check` and the scripts suite through `check-tests-leave-git-alone.js`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the 15 known manifest findings are reported, then baselined |
| 2 | today's tree exits 0; one injected finding exits 1 |
| 3 | `make check` and the scripts suite pass |
