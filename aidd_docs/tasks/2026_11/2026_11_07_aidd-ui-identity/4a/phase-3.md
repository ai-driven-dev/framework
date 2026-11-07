---
status: pending
---

# Instruction: skills, split `01-system`, rename `02-journeys`

## Architecture projection

```txt
.
├── plugins/aidd-ui/
│   ├── .claude-plugin/plugin.json ✏️
│   └── skills/
│       ├── 01-system/ ❌
│       ├── 02-journeys/ ❌
│       ├── 01-journeys/ ✅
│       │   └── SKILL.md ✅
│       ├── 02-brand/ ✅
│       │   ├── SKILL.md ✅
│       │   ├── actions/
│       │   │   ├── 01-prepare.md ✅
│       │   │   ├── 02-write.md ✅
│       │   │   └── 03-conclude.md ✅
│       │   ├── assets/brand-template.md ✅
│       │   └── references/
│       │       ├── cases.md ✅
│       │       └── engine.md ✅
│       ├── 03-foundations/ ✅
│       │   ├── SKILL.md ✅
│       │   ├── actions/
│       │   │   ├── 01-prepare.md ✅
│       │   │   ├── 02-write.md ✅
│       │   │   └── 03-conclude.md ✅
│       │   ├── assets/system-template.md ✅
│       │   └── references/
│       │       ├── cases.md ✅
│       │       ├── engine.md ✅
│       │       ├── extraction.md ✅
│       │       ├── tokens.md ✅
│       │       └── versions.md ✅
│       └── 04-components/ ✅
│           ├── SKILL.md ✅
│           ├── actions/
│           │   ├── 01-prepare.md ✅
│           │   ├── 02-write.md ✅
│           │   └── 03-conclude.md ✅
│           ├── assets/
│           │   ├── component-template.md ✅
│           │   ├── asset-template.md ✅
│           │   └── render-template.html ✅
│           └── references/
│               ├── cases.md ✅
│               ├── engine.md ✅
│               ├── elements.md ✅
│               ├── extraction.md ✅
│               └── versions.md ✅
└── scripts/
    ├── aidd-ui-pilot.cjs
    └── __tests__/aidd-ui/skill.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | the fixture project | validates | cli |
| Happy path | fill each template from its owning skill, among a design system | `VALID` | cli |
| Edge case | the manifest or `skills/` lists another set than the four | test fails | cli |
| Edge case | a template's `kind` held by two skills | test fails | cli |
| Edge case | a skill file names `NN-name` not its own, a date or an em-dash | test fails | cli |
| Edge case | a token rename, from foundations alone | only the component rules it leaves, listed as owed | cli |

## Tasks to do

### `1)` Structure tests first

> The four skills and their boundaries are pinned before any file moves.

1. `skill.test.js`: manifest and `skills/` equal `01-journeys`, `02-brand`, `03-foundations`, `04-components`.
2. One loop over every `skills/*`: names no other skill, no date, no em-dash; links stay with `a-skill-links-only-inside-itself.test.js`, the journeys link assertion deleted.
3. One author per kind: the `kind:` line of every `assets/*-template.md`, split on `,` and `or`, each kind in one skill.
4. Template fills point at their owning skill; change-flow and resolver tests keep their engine assertions under the new skill names; the "brand and tokens first" test deleted.
5. Run wrapped: red on the structure only.

### `2)` Rename `02-journeys`

> Same skill, new place.

1. `git mv` to `01-journeys`; `name: 01-journeys`.

### `3)` Split `01-system`

> Three skills take over everything it did, adding nothing.

1. `git mv` each file to its owner, then cut each to its owner's rows:
   - `02-brand`: `brand.md`, from the brand template; from the code its answers from the README, manifest and visible copy, confirmed; from scratch asked; `brand.md` present: stop; owed T1 (observed: `validate` on `brand.md` alone prints T1 only).
   - `03-foundations`: stops without `brand.md`; reads its personality, references and anti-references; `system.md`, `tokens.json` and context files, `extract`, `tokens`, `impact` and `bump --change` on tokens, `bump --created system`, `publish` of the system; extraction rows for token files, code roots, themes, what `extract` leaves, generated output, colour literals, `ignore`.
   - `04-components`: stops without `system.md`; components, assets, renders per `elements.md`; `impact`, `bump --change`, `--removed`, `--created` on elements; deprecation; `publish <id>`; extraction rows for component files, platforms, gaps, axes, assets, unlinked files.
2. Each `SKILL.md`: `name` its folder, a `Use when`/`Not for` description, `argument-hint: request`, the `01-system` flow, its stop naming the missing file; transversal rules as `01-system`'s, each writing only its own files.
3. Each `engine.md`: its commands only; owed rows observed by running `validate` on the state the skill leaves, a token rename's component errors among them.
4. `cases.md`: the from-scratch row loses "propose the brand and the tokens first, components when a screen asks for them".
5. `plugin.json` `skills`: the four.

### `4)` Pilot chain

> The same requests, one per skill.

1. `aidd-ui-pilot.cjs`: `/aidd-ui:01-journeys <journeys>`, `/aidd-ui:02-brand <brand>`, `/aidd-ui:03-foundations <foundations>`, `/aidd-ui:04-components <components>`.

### `5)` Mutations

> Each structure test turns red for its own breach.

1. One at a time, run wrapped, restore: a fifth folder under `skills/`; `brand-template.md` copied into `03-foundations/assets/`; `02-brand` naming `03-foundations` in an action.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | the structure tests fail on the old tree, for the structure alone |
| 2 | `01-journeys` validates its templates as `02-journeys` did |
| 3 | every `01-system` row lives in a new skill, the deleted line excepted; the wrapped suite passes |
| 4 | the pilot sends one request per skill, the parts unchanged |
| 5 | every structure guard has a mutation its own test kills |
