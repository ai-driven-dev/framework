---
status: implemented
---

# Instruction: The 01-system skill

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_10/2026_10_30_aidd-ui-rework/
│   ├── spec.md                          ✏️ PR 2 decision rows as built
│   └── roadmap.md                       ✏️ 01-hello gone
└── plugins/aidd-ui/
    ├── .claude-plugin/plugin.json       ✏️ skills list
    ├── README.md                        ✏️ start with 01-system, commands, new rules, limits
    └── skills/
        ├── 01-hello/                    ❌
        └── 01-system/                   ✅
            ├── SKILL.md                 router
            ├── actions/
            │   ├── 01-survey.md         blank or existing, what is already there
            │   ├── 02-brand.md          brand.md and system.md
            │   ├── 03-extract.md        tokens, assets and components read from the code
            │   ├── 04-tokens.md         tokens, themes, tokens.css
            │   ├── 05-components.md     assets, components and their renders
            │   └── 06-change.md         impact, apply, regenerate, versions, review expected
            └── assets/
                ├── system.md            record templates
                ├── brand.md
                ├── component.md
                ├── asset.md
                └── render.html
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | copy the templates into a temp `aidd_docs/ui/` with placeholder values filled | files in place | system |
| Happy path   | validate the filled templates | VALID: the templates follow the validator's format | cli |
| Happy path   | run the pre-commit gate | skill frontmatter, router coherence, links, prose paths and duplication checks pass; CATALOGs list 01-system, not 01-hello | cli |
| Edge case    | the skill's text names another skill | none: the change flow ends with "a review is expected" | system |

## Tasks to do

### `1)` Router and actions

> One skill lays the design system and carries a change through.

1. `SKILL.md` in the lean router format of `aidd-dev:01-plan`: a mermaid of the actions, survey routing to brand then extract or tokens, components, and change for an existing design system.
2. Each action: Input, Process, Output, Test. Every write is followed by the hook's feedback; without the hook, the action runs the engine's `validate` itself.
3. The engine is the plugin's `hooks/aidd-ui.cjs`; when the skill ships alone without it, the action stops and says the engine is missing.
4. `03-extract` reads code roots, existing token files and components, writes tokens and records with `code` links and `implemented-version`, and uses the C3 warnings to find what is left.
5. `06-change`: `impact` first and show the report; after the person agrees, apply, run `tokens` when tokens changed, rewrite the markup of reached renders whose elements changed, raise each changed element's version with a history row naming the task folder, set it back to `proposed`, then stop saying a review is expected.

### `2)` Record templates

> The model starts from a shape the validator accepts.

1. One template per record kind the skill writes, and a render skeleton loading `../tokens.css` with `data-variant` and `data-state` blocks.
2. A test fills them and validates them.

### `3)` Retire 01-hello and document

> The plugin starts where the work starts.

1. Delete `skills/01-hello`, update `plugin.json`, the README's Start with, commands and limits, the roadmap line and the spec's PR 2 rows.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `pnpm exec lefthook run pre-commit` passes; no skill name appears in another skill's files |
| 2 | the filled templates validate VALID in a test |
| 3 | no file outside history and evidence names `01-hello`; the regenerated CATALOGs list `01-system` |
