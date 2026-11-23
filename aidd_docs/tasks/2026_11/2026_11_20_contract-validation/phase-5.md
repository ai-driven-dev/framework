---
status: pending
---

# Instruction: Rule, command, story and hook contracts

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/
│   ├── aidd-context/
│   │   ├── CATALOG.md ✏️
│   │   └── skills/
│   │       ├── 05-rule-generate/
│   │       │   ├── assets/
│   │       │   │   └── rule-template.md ✏️
│   │       │   └── scripts/
│   │       │       ├── contract.json ✅
│   │       │       ├── validate-rule.cjs ✅
│   │       │       └── lib/ ✅
│   │       ├── 07-command-generate/
│   │       │   └── scripts/
│   │       │       ├── contract.json ✅
│   │       │       ├── validate-command.cjs ✅
│   │       │       └── lib/ ✅
│   │       └── 08-hook-generate/
│   │           ├── SKILL.md ✏️
│   │           ├── actions/
│   │           │   └── 04-verify.md ✏️
│   │           ├── assets/
│   │           │   └── hook-template.md ✅
│   │           ├── references/
│   │           │   └── writer.md ✏️
│   │           └── scripts/
│   │               ├── contract.json ✅
│   │               ├── hooks-schema.json ✅
│   │               ├── validate-hooks.cjs ✅
│   │               ├── verify-hook.cjs ❌
│   │               ├── checks/ ✅
│   │               └── lib/ ✅
│   └── aidd-pm/
│       └── skills/
│           └── 02-user-stories/
│               └── scripts/
│                   ├── contract.json ✅
│                   ├── validate-story.cjs ✅
│                   └── lib/ ✅
└── scripts/
    └── __tests__/
        ├── hook-verification.test.js ❌
        └── contract/
            ├── rule-contract.test.js ✅
            ├── command-contract.test.js ✅
            ├── story-contract.test.js ✅
            └── hooks-contract.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | fixture rule source under `aidd_docs/rules/`, one story, one command | files ready | system |
| Happy path   | each raw template, then a filled copy | raw flagged, filled clean | cli |
| Edge case    | rule frontmatter without description, or with an unknown target | rule finding | cli |
| Edge case    | story status outside the lifecycle | story finding listing the allowed values | cli |
| Edge case    | `hooks.json` with `async` on a handler | clean | cli |
| Edge case    | `hooks.json` naming a missing handler, or one with a syntax error | hook finding | cli |
| Teardown     | remove fixtures | baseline restored | system |

## Tasks to do

### `1)` Rule contract

> The neutral rule source is validated; host copies never are.

1. Give `rule-template.md` a frontmatter of description, optional paths, and targets.
2. Port the prototype rule contract on `aidd_docs/rules/**` and add `validate-rule.cjs`.
3. Keep `write-rule.cjs` input refusals and rendering unchanged.

### `2)` Command and story contracts

> Each raw template fails, each filled one passes.

1. Port the prototype command contract into `07-command-generate`.
2. Port the prototype story contract into `02-user-stories`, statuses from `references/lifecycle.md`, Cancellation optional.

### `3)` Hook contract

> Form of `hooks.json` and its handlers, replacing `verify-hook.cjs`.

1. Port the prototype schema with `async` allowed, and the handler check (file exists, `node --check`), without the H7 grep.
2. Add `assets/hook-template.md`: one `hooks.json` entry and a handler skeleton.
3. Delete `verify-hook.cjs` and `hook-verification.test.js`.
4. Rewrite `04-verify.md`, the `SKILL.md` verifier edge and `writer.md` around `validate-hooks.cjs`.
5. Run `sync.cjs` and regenerate `plugins/aidd-context/CATALOG.md`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `rule-generation.test.js` passes unchanged; raw rule template flagged |
| 2 | raw command and story templates flagged, filled ones clean |
| 3 | every real `plugins/*/hooks/hooks.json` is clean; `grep -r verify-hook plugins scripts` finds nothing |
