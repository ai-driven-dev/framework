# Rules for generated skills

These rules apply EXCLUSIVELY to skills produced by the `skills` sub-flow of `aidd-context:03:context-generate`. They do NOT apply to agents, rules, commands, hooks, plugins, or marketplaces - each of those artifact types has its own conventions documented in `assets/` and `references/`.

The `skills` sub-flow MUST enforce R1-R10 on every skill it generates.

- **R1** - SKILL.md is a pure router: description + action table + transversal rules. Zero business logic.
- **R2** - One skill = one domain (tool OR activity). Tool -> singular noun (`slack`); activity -> action verb (`review`). See `naming-conventions.md`.
- **R3** - References one-level deep. Never chain reference -> reference.
- **R4** - SKILL.md <= 500 lines. If exceeded, split into references.
- **R5** - Description must include: what, explicit triggers, "Do NOT use for..." clause.
- **R6** - Zero duplication. Templates live in `assets/`; actions point to them via `@<path>`.
- **R7** - `references/` = documents to READ (conventions, cheatsheets). `assets/` = files to COPY or INJECT (templates, ID tables).
- **R8** - Every action has a `## Test`: one sentence describing how to verify its intent - a command to run, a concrete check on the produced artifact, or an observable side-effect (API/MCP/state).
- **R9** - Auto-trigger skills (`disable-model-invocation: false`, default) ship `evals/scenarios.json` = JSON array of at least 3 `{prompt, expect_action}`. Manual-only skills skip.
- **R10** - Generated skills are written in **English only** (frontmatter, body, actions, references, assets). Holds regardless of conversation language.
