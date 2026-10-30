---
status: pending
---

# Instruction: Tokens and renders

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-ui/hooks/lib/
│   ├── tokens.cjs ✅
│   └── renders.cjs ✅
└── scripts/__tests__/
    └── aidd-ui-tokens-renders.test.js ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `writeProject(tmp)` | the valid project | system |
| Happy path   | `tokens.check(load(tmp))`, `renders.check(load(tmp))` | both `[]` | system |
| Edge case    | T1: `tokens.json` not JSON | one problem | system |
| Edge case    | T2: a name starting with `$` that is not a reserved key; a name holding `.` | one problem each | system |
| Edge case    | T3: a token without `$value`; without any `$type`; with `$type: colour` | one problem each | system |
| Edge case    | T4: color `colorSpace: cmyk`; color with two components; `hex: #fff`; dimension `unit: em`; duration `unit: min`; fontWeight `1200`; cubicBezier x `1.5` | one problem each | system |
| Edge case    | T5: `{color.missing}`; `{color.brand}` naming a group | one problem each | system |
| Edge case    | T6: theme `sepia` absent from `system.md`; a theme value of the wrong shape | one problem each | system |
| Edge case    | T7: a component `tokens` entry naming no token | one problem | system |
| Edge case    | T8: a dimension token in `px` | one problem: sizes are in `rem` | system |
| Edge case    | V1: a component or screen without its `.html` | one problem | system |
| Edge case    | V2: a declared variant or state with no `data-variant` or `data-state` in the render | one problem each | system |
| Edge case    | V3: `var(--color-missing)` in a render | one problem | system |
| Edge case    | V4: `#336699`, `rgb(`, `hsl(` in a render | one problem each, with its line | system |
| Edge case    | V6: `16px`, `1.5rem` or `200ms` written in a render | one problem each: only tokens carry values | system |
| Edge case    | V5: `margin-left` in a render while `system.md` declares `rtl`; the same with only `ltr` | one problem; none | system |
| Teardown     | remove `tmp` | no file left | system |

## Tasks to do

### `1)` Token rules

> T1 to T8 hold.

1. `tokens.cjs`: walk the tree; a key starting with `$` is a property, any other is a group or a token, a token being an object with `$value`.
2. Resolve `$type`: own, else the aliased token's, else the closest group's.
3. Check primitive shapes per the 2025.10 module; for composite types, check only that `$value` exists.
4. Read themes from `$extensions["dev.ai-driven.themes"]`; check names against `system.md` `themes`, values against the token's type.
5. Require `rem` on every dimension token.
6. Export the set of token paths and their CSS names for renders.

### `2)` Render rules

> V1 to V6 hold.

1. `renders.cjs`: require `<id>.html` beside each component and screen record.
2. Find `data-variant="x"` and `data-state="x"` for each declared variant and state.
3. Flag each `var(--x)` with no token, each colour literal (`#` with 3, 4, 6 or 8 hex digits, `rgb(`, `rgba(`, `hsl(`, `hsla(`) with its line, and, when `rtl` is declared, each `margin-left`, `margin-right`, `padding-left`, `padding-right`, `border-left`, `border-right`, `left:`, `right:`, `text-align: left`, `text-align: right`, `float: left`, `float: right`.
4. Flag each number followed by `px`, `rem`, `em`, `ms` or `s` outside `var(...)`; `0` alone passes.
5. Export the colour, unit and physical-property patterns for the code checks.

### `3)` Tests

> Each rule has its mutation.

1. `aidd-ui-tokens-renders.test.js`: the Happy path, then one test per Edge case row.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | each of T1 to T8 has its own message |
| 2 | each of V1 to V6 has its own message; `ltr` alone allows physical properties |
| 3 | reverting any one rule turns exactly its test red |
