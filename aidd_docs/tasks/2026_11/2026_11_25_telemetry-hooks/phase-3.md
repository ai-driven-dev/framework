---
status: pending
---

# Instruction: Docs and checks

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs/
│   └── ARCHITECTURE.md                       ✏️
├── aidd_docs/product/
│   └── usage-contract.md                     ✏️
├── plugins/aidd-telemetry/
│   ├── README.md                             ✏️
│   └── CATALOG.md                            ✏️ regenerated
└── scripts/
    ├── check-claude-tokens-end-to-end.cjs    ✏️
    └── __tests__/fixtures/telemetry-bindings/
        └── README.md                         ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | phases 1 and 2 merged on the branch | ready state | system |
| Happy path | `node scripts/check/run.cjs` | exit 0, baseline not raised | cli |
| Edge case  | `node scripts/check/engine/sync.cjs --check` | exit 0: `lib/host.cjs` of aidd-telemetry matches its source | cli |
| Edge case  | `grep -rn "prompt-gate\|session-start.cjs\|catch-up.cjs" docs aidd_docs/product plugins scripts cli` | no hit outside `aidd_docs/tasks` once refacto-cli's branch is merged | cli |
| Teardown   | none | none | cli |

## Tasks to do

### `1)` Architecture

> aidd-telemetry is under the hook contract, with one stated exception.

1. `docs/ARCHITECTURE.md:80`: name aidd-telemetry among the plugins that follow the contract.
2. "SessionStart keeps a generated state true, silently": add "or informs the person once, never the model".
3. Rule 5: the reminder spawns git because no built-in reads git config. Rule 6: the telemetry ingest is async, runs `aidd`, and may take 120 s, because transcripts must be read before the host deletes them.
4. Rule 4: add `task.cjs remind` and `ledger.cjs ingest` to the entry examples.

### `2)` Usage contract

> The contract says what the hooks do now.

1. § Ask: replace the gate and the intercept by the reminder: when, to whom, never blocks, and that a late declaration moves earlier calls.
2. § Carry: remove; one line in § Residual limits for the session-only declaration lost on `/clear` or fork.
3. § Stores: `carries.jsonl` and `processes.jsonl` written by earlier versions only, still read; `by: hook-intercept` the same.
4. § Consent: drop the `session-start.cjs` exception; top table row "Plugin hooks": reminding of a task, ingesting.

### `3)` Plugin docs and scripts

> Nothing still describes or wires a deleted hook.

1. `plugins/aidd-telemetry/README.md`: diagram edge `Hooks -->|"remind when none"| You`, step 4 "when reminded, or later", Codex line: trust the new hooks once with `/hooks`.
2. `scripts/check-claude-tokens-end-to-end.cjs`: wire `task.cjs remind` and `ledger.cjs ingest` (line 314); `--attended` (lines 207-237) checks the reminder shows, the first prompt is billed without blocking, `! aidd telemetry task demo --ticket T-1` declares by `command`, and the report puts the calls before the declaration on `demo`; drop the intercept and carry checks; its test passes.
3. `scripts/__tests__/fixtures/telemetry-bindings/README.md`: drop the readers that no longer exist.

### `4)` Contributor checks

> The branch passes what `CONTRIBUTING.md` asks before a pull request, without `make`.

1. `node scripts/check/run.cjs`, `node scripts/check/engine/sync.cjs --check`, `node --test 'scripts/__tests__/**/*.test.{js,mjs,cjs}'`.
2. Hand the branch SHA to refacto-cli, which merges it with its cli/ branch so the hooks-routes fixtures go green in the same PR.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `ARCHITECTURE.md` no longer says aidd-telemetry stays outside, and names the ingest exception |
| 2    | usage contract has no § Carry and no gate; § Ask describes the reminder |
| 3    | the grep of the Test Scope finds nothing outside `aidd_docs/tasks`; the end-to-end script test passes |
| 4    | the three commands exit 0; refacto-cli has the SHA |
