---
status: pending
---

# Instruction: Engine and vendoring

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── scripts/
│   ├── contract/
│   │   ├── engine.cjs ✅
│   │   ├── ops.cjs ✅
│   │   ├── markdown.cjs ✅
│   │   ├── scaffold.cjs ✅
│   │   └── sync.cjs ✅
│   └── __tests__/
│       └── contract/
│           ├── engine.test.js ✅
│           ├── ops.test.js ✅
│           └── sync.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | fixture contracts and artifacts in a temp dir | files ready | system |
| Happy path   | run the engine on a valid artifact | exit 0, no output | cli |
| Edge case    | artifact breaks one rule | exit 1, one `path:line ID fix "excerpt"` line | cli |
| Edge case    | contract has an unknown op or key | exit 2, contract error on stderr | cli |
| Edge case    | template op on a raw template | exit 1, unfilled slot reported, including a slot in code | cli |
| Edge case    | json op on invalid JSON or a schema mismatch | exit 1, JSON path in the fix | cli |
| Edge case    | `sync.cjs --check` with a vendored copy edited | exit 1, the stale copy named | cli |
| Edge case    | scaffold onto an existing file, then validate | scaffold refuses to overwrite and runs no rule; the engine leaves every file unchanged | cli |
| Teardown     | remove the temp dir | baseline restored | system |

## Tasks to do

### `1)` Port the engine

> One source in `scripts/contract/`, Node built-ins only.

1. Port `engine.cjs`, `markdown.cjs`, `scaffold.cjs` and `ops.cjs` from the scratchpad prototype.
2. Merge `maxChars`, `maxLines` and `maxFiles` into one `max` op with `measure: chars|lines|files`.
3. Keep ops `template`, `json`, `max`, `pattern`, `forbidden`, `sections`, `equals`, `oneSentence`, `flatList`, `links`, `custom`.

### `2)` Vendoring

> Every skill holding `scripts/contract.json` gets a byte copy of the engine.

1. Write `sync.cjs`: copy the engine files into `<skill>/scripts/lib/`, and with `--check` report every copy that differs or is missing.

### `3)` Tests

> Lock the engine before any validator is replaced.

1. Write the tests of the Test Scope under `scripts/__tests__/contract/`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | each op has a passing and a failing fixture; same input gives the same output twice |
| 2 | `sync.cjs --check` exits 0 after `sync.cjs`, 1 after editing one copy |
| 3 | scaffold never validates, the engine never writes; the scripts suite passes through `check-tests-leave-git-alone.js` |
