---
status: pending
---

# Instruction: One slot syntax

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/
│   ├── aidd-context/
│   │   └── skills/
│   │       ├── 00-onboard/
│   │       │   └── assets/
│   │       │       └── report.md ✏️
│   │       ├── 01-bootstrap/
│   │       │   └── actions/
│   │       │       ├── 01-gather-needs.md ✏️
│   │       │       └── 04-pick-and-design.md ✏️
│   │       └── 04-skill-generate/
│   │           └── scripts/
│   │               └── scaffold-skill.cjs ✏️
│   ├── aidd-dev/
│   │   └── skills/
│   │       └── 09-for-sure/
│   │           └── assets/
│   │               └── plan-template.md ✏️
│   └── aidd-pm/
│       └── skills/
│           └── 03-prd/
│               └── assets/ ✏️
└── scripts/
    └── __tests__/
        └── scaffold-skill.test.js ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | list every asset template holding a slot | 70 templates listed (of 80 `.md` assets, 10 hold no slot) | system |
| Happy path   | run the template check from the scratchpad on each template | each raw template is flagged, each filled copy passes | cli |
| Edge case    | grep `<[a-z]` slots in assets | none left outside HTML and code samples | cli |
| Edge case    | scaffold a skill | the copy carries `{{…}}` slots | cli |

## Tasks to do

### `1)` Convert the templates

> Every asset template marks slots as `{{…}}`.

1. Apply the 37-template conversion tested in the scratchpad copy of the tree.
2. Convert the for-sure `{x}` dialect, the PRD `[…]` slots and the nested onboard slot by hand.

### `2)` Follow the callers

> Code and prose that name the old slots.

1. Update `scaffold-skill.cjs` slot strings and `scaffold-skill.test.js` assertions.
2. Update the two bootstrap actions that cite `<...>` placeholders.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | 70 of 70 templates: raw flagged, filled clean |
| 2 | `scaffold-skill.test.js` and the scripts suite pass |
