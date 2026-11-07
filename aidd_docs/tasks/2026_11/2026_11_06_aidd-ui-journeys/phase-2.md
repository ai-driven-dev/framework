---
status: pending
---

# Instruction: skill 02-journeys

## Architecture projection

```txt
.
├── plugins/aidd-ui/
│   ├── .claude-plugin/plugin.json ✏️
│   └── skills/
│       ├── 01-system/
│       │   ├── actions/02-write.md ✏️
│       │   └── references/
│       │       ├── cases.md ✏️
│       │       └── engine.md ✏️
│       └── 02-journeys/
│           ├── SKILL.md ✅
│           ├── actions/
│           │   ├── 01-prepare.md ✅
│           │   ├── 02-write.md ✅
│           │   └── 03-conclude.md ✅
│           ├── assets/
│           │   ├── journey-template.md ✅
│           │   ├── wireframe-template.md ✅
│           │   └── wireframe-render-template.html ✅
│           └── references/
│               ├── cases.md ✅
│               └── engine.md ✅
└── scripts/__tests__/aidd-ui/skill.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | fill each template into the fixture project | files written | system |
| Happy path | validate | 0 errors; elements start `proposed` at version 1 | cli |
| Edge case | grep the skill's files | no other skill named, no date, no em-dash, no link outside it | system |
| Edge case | read the manifest | it lists `01-system` and `02-journeys` | system |

## Tasks to do

### `1)` Templates

> A journey, a wireframe and its render that validate once filled.

1. Test: every placeholder filled, none left; the filled set validates; each starts `proposed` at version 1.
2. Write the three templates: journey with `persona`, `## Persona`, `## Steps`; wireframe with `uses`, `states`, `zones`; render with `data-state` and `data-zone`, no token.

### `2)` Skill

> Prepare, write, conclude, lean as `01-system`.

1. Cases: from scratch, ask the persona, reuse one a brief describes; from the code, deduce journeys and wireframes from real screens, then the person confirms.
2. Prepare: the persona, the journeys wanted, the steps.
3. Write: journey; per step without screen or wireframe, an empty wireframe `proposed`; `bump --created`.
4. Conclude: validate until only warnings are left; each record stays `proposed`, its review coming with the screens; a missing component is named, never created.
5. Test: names no other skill, holds no date or em-dash, links nothing outside it.

### `3)` Manifest

> The plugin ships both skills.

1. Test "only skill" becomes: the manifest and the folder hold `01-system` and `02-journeys`.
2. `plugin.json` lists `./skills/02-journeys`; its description names journeys and wireframes.

### `4)` System from scratch

> The design system proposes brand and tokens first; the person stays free.

1. Test: `01-system`'s from-scratch case says brand and tokens first, components when a screen asks.
2. Edit `cases.md` and `02-write.md`; `engine.md` lists the `wireframes` impact key.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | filled templates validate, `proposed` at version 1 |
| 2 | the skill names no other skill and links nothing outside it |
| 3 | manifest and folder list both skills |
| 4 | from scratch, `01-system` proposes brand and tokens first |
