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
| Edge case    | C3: a link to `src/ui/search/SearchField.tsx` beside a hook and a `__tests__/` file | no problem: the link covers its folder | system |
| Edge case    | C3: `src/ui/Orphan.css` beside `src/ui/Button.tsx` at the code root | one problem: a file at a root covers only itself | system |
| Edge case    | C4: `padding: 16px` in a linked stylesheet | no problem: only colours are checked in code | system |
| Edge case    | R8: search-field `coded` without `code`, button coded; then button `validated` | no problem; then one problem | system |
| Edge case    | R17: dialog without `## Usage` | one problem | system |
| Edge case    | T9: button citing `color.brand.primary` | one problem | system |
| Teardown     | remove `tmp` | no file left | system |

## Tasks to do

### `1)` Contract

> The spec follows what Gouvernail showed, and stays lean.

1. `spec.md`: a link covers its folder; an assembled element is coded through its components; primitive and semantic tokens; `## Usage`; optional glossary and rules; only colours checked in code, other literals and forbidden words left to the audit.

### `2)` Rules

> Each change has the mutation that proves it.

1. `code.cjs`: C3 covers the folder of each linked file outside a code root; C4 drops unit literals in code.
2. `records.cjs`: `primitives` required in `system.md`; R8 accepts a molecule or composition whose used components, assets aside, are all coded; R17 needs `## Usage` on every component.
3. `tokens.cjs`: T9 names a component token under a `primitives` group.
4. `README.md`: the format table and limits follow.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the spec names every rule below and moves unit literals and forbidden words to the audit |
| 2 | a folder-covered file, an orphan at a root, an uncoded component under a coded molecule, a missing usage and a primitive token each behave as the test scope says; reverting any one rule turns exactly its test red |
