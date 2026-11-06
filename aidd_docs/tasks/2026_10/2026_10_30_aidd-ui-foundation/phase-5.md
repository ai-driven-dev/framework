---
status: done
---

# Instruction: Fit a real project

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_10/2026_10_30_aidd-ui-rework/
│   └── spec.md ✏️
├── plugins/aidd-ui/
│   ├── README.md ✏️
│   └── hooks/lib/
│       ├── code.cjs ✏️
│       ├── records.cjs ✏️
│       └── tokens.cjs ✏️
└── scripts/__tests__/
    ├── aidd-ui-code.test.js ✏️
    ├── aidd-ui-records.test.js ✏️
    ├── aidd-ui-tokens-renders.test.js ✏️
    └── fixtures/aidd-ui/project.js ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `writeProject(tmp)`, now with `primitives: [color.brand]`, a semantic `color.action.default` and a `## Usage` on every component | the valid project | system |
| Happy path   | every check on it | `[]` | system |
| Edge case    | C4: `padding: 16px` in a linked stylesheet | no problem: only colours are checked in code | system |
| Edge case    | R8: search-field `coded` without `code`, button coded; then button `validated` | no problem; then one problem | system |
| Edge case    | R17: dialog without `## Usage` | one problem | system |
| Edge case    | T8: button citing `color.brand.primary` | one problem | system |
| Edge case    | R6, R7: an atom using an atom; a screen using itself; an interactive component without hover or disabled, then without focus | no problem; one; none; one | system |
| Edge case    | T5, T3: a dimension aliasing a colour; a broken alias without `$type` | one problem; one problem, not two | system |
| Edge case    | T6: a themed token without `dark`; a value for the base theme; a theme value aliasing a dimension | one problem each | system |
| Edge case    | raw CSS: `color-mix()` under `dev.ai-driven.css`; an empty one; a `$root` | none; one; one | system |
| Edge case    | V3: a custom property the render sets itself | no problem | system |
| Edge case    | C3: `search-field/search-field.component.tsx` beside a filter and `__tests__/`; `Button.module.css` and `Orphan.tsx` beside `Button.tsx` | none; only `Orphan.tsx` | system |
| Teardown     | remove `tmp` | no file left | system |

## Tasks to do

### `1)` Contract

> The spec follows what Gouvernail showed, and stays lean.

1. `spec.md`: a link covers its own folder; an assembled element is coded through its components; primitive and semantic tokens; `## Usage`; optional glossary and rules; only colours checked in code, other literals and forbidden words left to the audit.

### `2)` Rules

> Each change has the mutation that proves it.

1. `code.cjs`: C3 covers the folder of each linked file outside a code root; C4 drops unit literals in code.
2. `records.cjs`: `primitives` required in `system.md`; R8 accepts a molecule or composition whose used components, assets aside, are all coded; R17 needs `## Usage` on every component.
3. `tokens.cjs`: T8 names a component token under a `primitives` group.
4. `README.md`: the format table and limits follow.

### `3)` Second real project

> What Gouvernail and Kairos extractions showed, run through the validator.

1. C3 covers a folder only when it bears the linked file's name, else the files of its stem.
2. R6 accepts the same level and names self-use; R7 requires `focus` only.
3. Tokens: the rem rule goes; the first theme is the base and every other theme is given; an alias must match its type; T3 stays silent on a broken alias; raw CSS rides `dev.ai-driven.css`; `$root` is named unsupported.
4. V3 accepts custom properties the render sets itself.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the spec names every rule below and moves unit literals and forbidden words to the audit |
| 2, 3 | a folder-covered file, an orphan at a root, an uncoded component under a coded molecule, a missing usage and a primitive token each behave as the test scope says; reverting any one rule turns exactly its test red |
