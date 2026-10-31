---
status: implemented
---

# Instruction: Run it on the pilots

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── plugins/aidd-ui/                     ✏️ only what the runs prove wrong
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | in the scratchpad: a blank web project; Gouvernail's copy; a Kairos copy without `node_modules`; each a git repository | three projects, nothing installed, the originals untouched | system |
| Happy path   | follow 01-system on the blank project from the brand | validate prints VALID; `tokens.css` generated; components rendered | cli |
| Happy path   | follow 01-system on Gouvernail and Kairos, extracting from the code | validate prints no error; each component links its code; C3 warnings are only what the record says is left | cli |
| Happy path   | on each, commit, then change one semantic token through `06-change` | the impact report names every reached component, screen, render and code file; versions rise with history rows; validate prints no error; a review is said to be expected | cli |
| Edge case    | edit a validated component without the flow | H8 names it | cli |
| Teardown     | none: the scratchpad holds the copies | originals untouched, checked by `git status` on each | system |

## Tasks to do

### `1)` Blank pilot

> The flow works from nothing.

1. Create a small web project in the scratchpad, `git init`.
2. Follow the skill from survey to components; record each friction.

### `2)` Gouvernail and Kairos

> Extraction works on real code.

1. Kairos copy without `node_modules`, `git init`; Gouvernail copy as it is in `gv/`.
2. Kairos: web apps as code roots, the Expo app outside, written as a limit.
3. Follow survey, brand, extract, tokens, components.

### `3)` Change flow

> A token change reaches everything it should.

1. On each pilot, commit, then change one semantic token through `06-change`.
2. Compare the impact report with a grep of the token across records and renders.

### `4)` Fix and record

> What the runs prove wrong is fixed in the plugin, with its test.

1. Each defect gets a failing test first, then the fix.
2. Run the whole scripts suite wrapped and the pre-commit gate.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the blank pilot validates with brand, system, tokens, tokens.css and at least three rendered components |
| 2 | both copies validate with no error other than true colour literals their code holds, which the skill leaves to the person; the extraction records a sample of components and the C3 warnings list the rest; `git status` in each original shows no change made by this run |
| 3 | each impact report misses no record or render the grep finds |
| 4 | the scripts suite and pre-commit pass |
