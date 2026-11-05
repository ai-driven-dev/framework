---
status: pending
---

# Instruction: Templates rebuilt: what an agent cannot derive

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── plugins/aidd-context/skills/02-project-memory/assets/templates/memory/
│   ├── core/project-brief.md ✏️
│   ├── core/architecture.md ✏️
│   ├── core/codebase-map.md ❌
│   ├── core/coding-assertions.md ✏️
│   ├── core/testing.md ✏️
│   ├── core/vcs.md ✏️
│   ├── ecosystem/ecosystem.md ✏️
│   ├── api/integration.md ❌
│   ├── backlog/backlog.md ✏️
│   ├── deployment/deployment.md ✏️
│   ├── infra/infra.md ❌
│   ├── contract/contract.md ✅
│   ├── api/api.md ❌
│   ├── cli/cli.md ❌
│   ├── package/package.md ❌
│   ├── auth/auth.md ✏️
│   ├── data/data.md ✏️
│   ├── database/database.md ❌
│   ├── async/async.md ✅
│   ├── messaging/messaging.md ❌
│   ├── realtime/realtime.md ❌
│   ├── ui/ui.md ✅
│   ├── ui/design.md ❌
│   ├── ui/forms.md ❌
│   ├── ui/navigation.md ❌
│   ├── native/native.md ✅
│   ├── mobile/mobile.md ❌
│   └── desktop/desktop.md ❌
├── plugins/aidd-context/skills/02-project-memory/references/capabilities.md ✏️
├── plugins/aidd-context/skills/12-cook/assets/recipes/connect-services.md ✏️
└── scripts/__tests__/
    └── memory-templates.test.js ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | word and section count of the templates at the base head | 24 files, 79 sections | system |
| Happy path | each template copied into a temp bank and run through `memory-lint.cjs` | only M3 errors, one per `{{…}}` line | system |
| Edge case | a project with `aidd_docs/ui/system.md` | `ui.md` holds one line pointing to `aidd_docs/ui/` | system |
| Edge case | a conditional concern whose questions find nothing non-derivable | no file written | system |

## Tasks to do

### `1)` Always written

> Six files every agent needs before any task.

1. `project-brief`: Purpose, Domain language, Out of scope.
2. `architecture`: Stack (one line each, with its reason), Areas (top-level folders whose role the name does not show, one level, entry points), Decisions, Constraints, Placement, Flow (only across processes or repositories).
3. `coding-assertions`: Gates (command, when, what it proves), Prerequisites.
4. `testing`: Layers (which change gets which test), Conventions (mocking, fixtures), Browser QA when a journey exists.
5. `vcs`: Branches, Commits (deviations only), Pull requests (base, merge, stacking), Agent may.
6. `ecosystem`: Systems (who reaches it and how, what the agent must know), Hand-offs; it absorbs integration.

### `2)` Written only when the scan finds something

> No empty skeleton loaded every session.

1. `backlog`: the team's decisions only, five to eight lines (tool, authority, estimation scale, ordering, Definition of Done); items and their statuses stay in the tracker and in aidd-pm's own folder. `deployment` (absorbs infra), `contract` (api, cli, package), `auth`, `data` (database, data), `async` (messaging, realtime), `ui` (design, forms, navigation), `native` (mobile, desktop).
2. Each section's `{{…}}` line is the question the writer answers; a file with no answer is not written.
3. `ui`: with `aidd_docs/ui/system.md` present, one line pointing to `aidd_docs/ui/`; without it, Rules (tokens not literals, naming the project's token file; reuse before create; where validation lives), Accessibility bar, See a change (one command or URL).

### `3)` Links and guard

> Nothing points to a template that left.

1. Update `capabilities.md` rows and `Former files`, and the template links of `connect-services.md`.
2. Write `memory-templates.test.js` first: every template passes the engine except its `{{…}}` lines; every `capabilities.md` file has a template.
3. `assets/templates/memory/README.md` drops its restated reader rules (non-derivable, points to the code, current state, kept small) and points to `references/memory-rules.md`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | the six templates hold no section the code answers; each copied into a bank gives M3 errors only |
| 2 | each conditional template's lines are questions; the `ui` template states the pointer line when `aidd_docs/ui/system.md` exists |
| 3 | `memory-templates.test.js` fails before and passes after; no link points to a deleted template |
