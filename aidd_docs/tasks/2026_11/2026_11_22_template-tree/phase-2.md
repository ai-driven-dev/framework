---
status: pending
---

# Instruction: aidd-dev artifact contracts

## Architecture projection

```txt
.
├── plugins/
│   └── aidd-dev/
│       ├── hooks/
│       │   └── lib/
│       │       └── contracts/ ✏️
│       └── skills/
│           ├── 03-assert/
│           │   ├── actions/01-assert.md ✏️
│           │   └── scripts/ ✅
│           ├── 04-audit/
│           │   ├── SKILL.md ✏️
│           │   ├── assets/audit-template.md ✏️
│           │   └── scripts/ ✅
│           └── 05-review/
│               ├── actions/03-conclude.md ✏️
│               └── scripts/ ✅
└── scripts/
    └── __tests__/
        └── check/
            └── dev-contracts.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | branch feat/1149-dev-contracts from feat/1149-artifact-hook | branch ready | system |
| Happy path   | validate a filled copy of each template | no finding | cli |
| Edge case    | validate each raw template | placeholder and comment findings | cli |
| Edge case    | replay the real review.md and assert.md files | only known defects reported, listed | cli |
| Edge case    | write a broken review.md in a session | turn-end hook names it | system |

## Tasks to do

### `1)` Branch

> Stack on the hook branch.

1. Create feat/1149-dev-contracts from feat/1149-artifact-hook.

### `2)` Review and assert contracts

> Rounds checked by the template.

1. 05-review: scripts/contract.json (kind review, unit file, scope `aidd_docs/**/review.md`, `in: review.md`, `optional` the four `###`), validate-review.cjs wrapper.
2. 03-assert: same shape, kind assert, scope `aidd_docs/**/assert.md`.
3. Add one line to 05-review actions/03-conclude.md step 4 and 03-assert actions/01-assert.md step 4: run the validate script on the file written.

### `3)` Audit contract

> Template carries only the report.

1. Remove the name, description, argument-hint front matter from 04-audit assets/audit-template.md. Checked: no repo contract reads it (scripts/check/contracts/memory.json targets aidd-context assets/templates only); rerun `node scripts/check/run.cjs` after the edit.
2. scripts/contract.json (kind audit, scope `aidd_docs/**/*_audit/*.md`), validate-audit.cjs; one line in SKILL.md transversal rules.

### `4)` Sync and tests

> Copies and proof.

1. Run `node scripts/check/engine/sync.cjs`.
2. Tests: raw template fails, filled passes, for each kind. Real samples exist only for review (38) and assert (1); audit has none in the repo, so its contract rests on the filled template alone, said in the PR.
3. Run `node --test scripts/__tests__` and `node scripts/check/run.cjs`.

### `5)` Contributor checks

> Pre-commit gate passes.

1. Run `pnpm exec lefthook run pre-commit`, then commit with scope aidd-dev.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | branch exists on top of feat/1149-artifact-hook |
| 2 | review and assert validate scripts pass filled copies and fail raw templates |
| 3 | audit template has no front matter; validate-audit passes a filled copy |
| 4 | aidd-dev hooks/lib/contracts lists the three new skills; all tests green |
| 5 | pre-commit passes |
