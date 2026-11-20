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
│   │       │   ├── actions/
│   │       │   │   ├── 01-gather-needs.md ✏️
│   │       │   │   └── 04-pick-and-design.md ✏️
│   │       │   └── assets/
│   │       │       ├── checklist.md ✏️
│   │       │       └── install-template.md ✏️
│   │       ├── 04-skill-generate/
│   │       │   ├── assets/
│   │       │   │   ├── action-template.md ✏️
│   │       │   │   ├── scope-frame.md ✏️
│   │       │   │   └── skill-template.md ✏️
│   │       │   └── scripts/
│   │       │       └── scaffold-skill.cjs ✏️
│   │       ├── 05-rule-generate/
│   │       │   └── assets/
│   │       │       └── rule-template.md ✏️
│   │       ├── 06-agent-generate/
│   │       │   └── assets/
│   │       │       └── agent-template.md ✏️
│   │       ├── 07-command-generate/
│   │       │   └── assets/
│   │       │       └── command-template.md ✏️
│   │       ├── 10-learn/
│   │       │   └── assets/
│   │       │       ├── adr-template.md ✏️
│   │       │       ├── learn-record.md ✏️
│   │       │       ├── proposal-table.md ✏️
│   │       │       └── report.md ✏️
│   │       └── 12-cook/
│   │           └── assets/
│   │               ├── recipe-template.md ✏️
│   │               └── validation-report-template.md ✏️
│   ├── aidd-dev/
│   │   └── skills/
│   │       ├── 08-debug/
│   │       │   └── assets/
│   │       │       └── task-template.md ✏️
│   │       └── 09-for-sure/
│   │           └── assets/
│   │               ├── autonomous-loop-worker-prompt.md ✏️
│   │               └── plan-template.md ✏️
│   ├── aidd-pm/
│   │   └── skills/
│   │       ├── 01-ticket-info/
│   │       │   └── assets/
│   │       │       └── ticket-template.md ✏️
│   │       ├── 02-user-stories/
│   │       │   └── assets/
│   │       │       └── user-story-template.md ✏️
│   │       ├── 03-prd/
│   │       │   └── assets/
│   │       │       └── prd-template.md ✏️
│   │       ├── 04-spec/
│   │       │   └── assets/
│   │       │       └── spec-template.md ✏️
│   │       ├── 05-spike/
│   │       │   └── assets/
│   │       │       └── spike-template.md ✏️
│   │       ├── 06-product-brief/
│   │       │   └── assets/
│   │       │       └── product-brief.md ✏️
│   │       ├── 07-epic/
│   │       │   └── assets/
│   │       │       └── epic-template.md ✏️
│   │       ├── 09-defect/
│   │       │   └── assets/
│   │       │       └── defect-template.md ✏️
│   │       └── 10-task/
│   │           └── assets/
│   │               └── task-template.md ✏️
│   ├── aidd-refine/
│   │   └── skills/
│   │       ├── 01-brainstorm/
│   │       │   └── assets/
│   │       │       └── discovery-brief.md ✏️
│   │       ├── 03-shadow-areas/
│   │       │   └── assets/
│   │       │       └── report-template.md ✏️
│   │       ├── 04-fact-check/
│   │       │   └── assets/
│   │       │       └── report-template.md ✏️
│   │       └── 05-review-conversation/
│   │           └── assets/
│   │               └── session-review-brief.md ✏️
│   └── aidd-vcs/
│       └── skills/
│           ├── 00-repo-init/
│           │   └── assets/
│           │       └── CONTRIBUTING.md ✏️
│           └── 04-issue-create/
│               └── assets/
│                   ├── CONTRIBUTING.md ✏️
│                   └── issue-template.md ✏️
└── scripts/
    └── __tests__/
        └── scaffold-skill.test.js ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | list every asset template holding a slot | 34 templates to convert; 67 of the 80 `.md` assets hold a slot afterwards | system |
| Happy path   | run the template check from the scratchpad on each template | each raw template is flagged, each filled copy passes | cli |
| Edge case    | grep `<[a-z]` slots in assets | none left outside HTML and code samples | cli |
| Edge case    | scaffold a skill | the copy carries `{{…}}` slots | cli |

## Tasks to do

### `1)` Convert the templates

> Every asset template marks slots as `{{…}}`.

1. Convert the `<…>` slots of the 34 templates of the projection; rerun the scratchpad conversion on this tree, whose `10-learn` differs from the tested copy.
2. Convert the for-sure `{x}` dialect, the PRD `[…]` slots and the nested onboard slot by hand.

### `2)` Follow the callers

> Code and prose that name the old slots.

1. Update `scaffold-skill.cjs` slot strings and `scaffold-skill.test.js` assertions.
2. Update the two bootstrap actions that cite `<...>` placeholders.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | 67 of 67 slot templates: raw flagged, filled clean |
| 2 | `scaffold-skill.test.js` and the scripts suite pass |
