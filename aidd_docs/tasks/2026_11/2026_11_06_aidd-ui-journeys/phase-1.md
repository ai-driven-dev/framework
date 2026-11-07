---
status: pending
---

# Instruction: engine, wireframe kind, journey and render rules

## Architecture projection

```txt
.
├── plugins/aidd-ui/hooks/lib/
│   ├── model.cjs ✏️
│   ├── records.cjs ✏️
│   ├── renders.cjs ✏️
│   ├── graph.cjs ✏️
│   └── bump.cjs ✏️
└── scripts/__tests__/
    ├── fixtures/aidd-ui/project.js ✏️
    └── aidd-ui/
        ├── records.test.js ✏️
        ├── tokens-renders.test.js ✏️
        ├── impact.test.js ✏️
        └── bump.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | fixture project gains `wireframes/search.md` and `.html`, a journey step naming it | `validate` prints no error | cli |
| Happy path | validate the fixture | 0 errors; impact of `dialog` lists `wireframes: [search]` and its journey | cli |
| Edge case | a step names neither a screen nor a wireframe | R12 error at that step | cli |
| Edge case | a journey without `## Persona` | R12 error naming the section | cli |
| Edge case | a wireframe `uses` an id no record has | R18 warning, no error | cli |
| Edge case | a step without action | R12 error at that step | cli |
| Edge case | a wireframe render holds `<style>`, `style=`, `<link>` or `var()` | V10 error at its line | cli |
| Edge case | a wireframe render lacks a state's or a zone's attribute | V2 error naming the attribute | cli |
| Edge case | a wireframe without `default` state, or with `platforms` | R7, R8 errors | cli |
| Edge case | `bump --created`, then `bump --change` of a component a wireframe expects | the wireframe's history rows at versions 1 and 2 | cli |

## Tasks to do

### `1)` Wireframe kind

> A wireframe is a versioned record in `wireframes/`.

1. Test: a `wireframe` record in `wireframes/` validates; missing `status`, `version`, `uses`, `states`, `zones` each errs (R3); elsewhere it errs (R2), whose fix text now names `wireframe`.
2. `model.cjs`: `FOLDER_KINDS.wireframes = ["wireframe"]`. `records.cjs`: `KIND_KEYS.wireframe`.
3. R7: a wireframe needs `default`, as a screen.

### `2)` Journey rule

> A step names a screen or a wireframe and its action; a journey describes its persona.

1. Fixture: the journey gains `## Persona`, so every fixture-based test still validates.
2. Test: a step naming a wireframe in `Screen` passes; naming neither errs; an empty `Action` errs; no `## Persona` errs.
3. R12 reads screen and wireframe ids, the action, and requires `## Persona`.

### `3)` Expected components

> An expected component that does not exist informs, never blocks.

1. Test: an id in a wireframe's `uses` that names no component is a R18 warning; a component id passes.
2. R18 in `records.cjs`, severity warning.

### `4)` Wireframe render

> Structure only, every state and zone shown, no token.

1. Test: V1 asks a render beside a wireframe; V2 asks `data-state` per state and `data-zone` per zone; V10 errs on `<style>`, `style=`, `<link>` and `var(` in a wireframe render.
2. `renders.cjs`: a kind list for V1 and V2 apart from `rendered`, which keeps V7 and V8; V10.

### `5)` Impact and versions

> A component change reaches the wireframes expecting it, then their journeys, and raises them.

1. Test: `impact dialog` reports `wireframes`; every existing report gains `wireframes: []`; `bump --change` raises a reached wireframe.
2. `graph.cjs`: `REPORT_KINDS.wireframes`. `bump.cjs`: reached includes `report.wireframes`.

### `6)` Mutations

> Each guard turns its own test red.

1. Per guard of tasks 1 to 5, revert it alone, run the wrapped suite, see its own test fail, restore.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | a wireframe validates in `wireframes/`, errs elsewhere or without its keys or `default` |
| 2 | a step naming nothing known or without action, or a journey without `## Persona`, errs |
| 3 | an expected component that does not exist warns, never errs |
| 4 | a wireframe render without a state, a zone, or with any style errs |
| 5 | the impact report lists reached wireframes, and `bump --change` raises them |
| 6 | every guard has a mutation its own test kills |
