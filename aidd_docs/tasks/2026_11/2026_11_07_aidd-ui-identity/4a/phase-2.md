---
status: pending
---

# Instruction: engine, `composition` becomes `organism`

## Architecture projection

```txt
.
├── plugins/aidd-ui/
│   ├── hooks/lib/
│   │   ├── model.cjs ✏️
│   │   └── records.cjs ✏️
│   └── skills/01-system/
│       ├── assets/component-template.md ✏️
│       └── references/elements.md ✏️
└── scripts/__tests__/
    ├── fixtures/aidd-ui/project.js ✏️
    └── aidd-ui/
        ├── records.test.js ✏️
        ├── validate.test.js ✏️
        └── skill.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | fixture `dialog` becomes `kind: organism` | the fixture still validates | cli |
| Happy path | an organism uses a molecule | no R6 | cli |
| Edge case | a molecule uses an organism | R6 `molecule cannot use organism "dialog"` | cli |
| Edge case | a record says `kind: composition` | R2 `unknown kind "composition"`, its fix listing `organism` | cli |
| Edge case | the hook tests edit a record to `kind: organism` | R6 elsewhere, as before | cli |

## Tasks to do

### `1)` Tests first

> The new name is pinned before the engine knows it.

1. `project.js`: `dialog` `kind: organism`, `organism` in the stamp list.
2. `records.test.js`: R6 expectations name `organism`; R2 fix text at 772-773 lists `organism`; a new case, `kind: composition` refused as unknown.
3. `validate.test.js:372-397`: `kind: composition` edits become `kind: organism`.
4. `skill.test.js:41`: fill key `atom, molecule or organism`.
5. Run wrapped: red for the name, and for nothing else.

### `2)` Engine

> One level renamed, no alias.

1. `model.cjs`: `FOLDER_KINDS.components` and `LEVELS` say `organism`. `records.cjs`: `KIND_KEYS.organism`.
2. `component-template.md` kind placeholder and `elements.md` level and no-link rows say `organism`.
3. `git grep -n composition -- plugins/aidd-ui scripts/__tests__/aidd-ui scripts/__tests__/fixtures/aidd-ui` prints nothing.

### `3)` Mutations

> Each guard turns its own test red.

1. `composition` added back to `KIND_KEYS` and `FOLDER_KINDS`: the refusal test fails.
2. `molecule` and `organism` levels swapped in `LEVELS`: the R6 test fails.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | the suite fails only on the renamed level before the engine changes |
| 2 | the wrapped suite passes; no `composition` left in the plugin or its tests |
| 3 | both mutations are killed by their own test |
