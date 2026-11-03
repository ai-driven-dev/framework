---
status: pending
---

# Instruction: Engine owns the mechanics

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-ui/
│   ├── README.md                         ✏️ commands, responsibilities
│   ├── hooks/
│   │   ├── aidd-ui.cjs                   ✏️ `extract`, `bump`, same-value tokens in `impact`
│   │   └── lib/                          ✏️ extract and bump modules
│   └── skills/01-system/                 ✏️ the skill calls them instead of doing them
└── scripts/__tests__/                    ✏️ aidd-ui tests
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | a project with a CSS token file holding `:root`, a `[data-theme]` block and an `@media` block, and a TS token object for a second platform | ready | system |
| Happy path   | `extract` | `tokens.json`, theme, breakpoint and platform files and the resolver written; every CSS name kept; `tokens` then `validate` give no token error; a second run writes the same bytes | cli |
| Happy path   | `bump` on a token change | each reached element raised, `proposed`, its History row; deprecated left; screens under review get `pending` rows; `validate` gives no H8, H6 or R13 | cli |
| Happy path   | `impact` on a token | also lists the tokens holding its value without aliasing it | cli |
| Edge case    | a value no DTCG type holds, a property outside `:root` | raw CSS kept, or listed as not extracted | cli |

## Tasks to do

### `1)` Extract tokens

1. `extract` reads the `code-tokens` files: CSS custom properties of `:root`, `[data-theme]` and `@media` blocks, and a JS or TS object of literal values.
2. Names map back to the same CSS name; values map to DTCG types, else raw CSS; differences by theme, breakpoint and platform go to their context files.
3. It prints what it wrote and what it left, as JSON.

### `2)` Apply versions

1. `bump` takes the task folder, the change, whether it breaks, and the refs; it applies the versions rules to what `impact` reaches.

### `3)` Same-value tokens

1. `impact` lists the tokens resolving to a reached token's value in a context without aliasing it.

### `4)` Responsibilities

1. The skill runs these commands and keeps only judgement; README states engine, hook and skill responsibilities.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | extraction of each observed shape round-trips its CSS names and validates; output is byte-stable |
| 2 | after `bump`, the fixture's token change validates with no hand edit |
| 3 | a token holding the same value without alias is listed, an alias is not |
| 4 | no versioning or extraction rule is restated in the skill as a procedure |
