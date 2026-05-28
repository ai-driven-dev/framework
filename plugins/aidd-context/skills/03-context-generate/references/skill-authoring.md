# Skill authoring

Conventions for every skill the `skills` sub-flow produces. These govern the CLIENT artifact (the skill written into the user's workspace), not this generator's own files. Each tool's on-disk path and file extension come from `@ai-mapping.md`.

## Rules

These rules apply EXCLUSIVELY to generated skills. They do NOT apply to agents, rules, commands, hooks, plugins, or marketplaces - each of those artifact types has its own conventions in `assets/` and `references/`. The `skills` sub-flow MUST enforce R1-R10 on every skill it generates.

- **R1** - SKILL.md is a pure router: description + action table + transversal rules. Zero business logic.
- **R2** - One skill = one domain (tool OR activity). Tool -> singular noun (`slack`); activity -> action verb (`review`). See `## Naming` below.
- **R3** - References one-level deep. Never chain reference -> reference.
- **R4** - SKILL.md <= 500 lines. If exceeded, split into references.
- **R5** - Description must include: what, explicit triggers, "Do NOT use for..." clause.
- **R6** - Zero duplication. Templates live in `assets/`; actions point to them via `@<path>`.
- **R7** - `references/` = documents to READ (conventions, cheatsheets). `assets/` = files to COPY or INJECT (templates, ID tables).
- **R8** - Every action has a `## Test`: one sentence describing how to verify its intent - a command to run, a concrete check on the produced artifact, or an observable side-effect (API/MCP/state).
- **R9** - Auto-trigger skills (`disable-model-invocation: false`, default) ship `evals/scenarios.json` = JSON array of at least 3 `{prompt, expect_action}`. Manual-only skills skip.
- **R10** - Generated skills are written in **English only** (frontmatter, body, actions, references, assets). Holds regardless of conversation language.

## Folder layout

```
<skill-name>/
  SKILL.md            (required) - router file; frontmatter + body
  actions/            (optional) - one .md per action: ## Inputs, ## Outputs, ## Process, ## Test
  assets/             (optional) - templates and other files actions COPY / INJECT via @<path>
  references/         (optional) - documents actions READ when they need the knowledge
  scripts/            (optional) - skill-local executables called from actions
  evals/              (optional) - auto-trigger probes; required when auto-invocation is on
  README.md           (optional) - human-facing summary; never loaded into the model context
```

A skill is identified by its directory name. The minimum is one `SKILL.md`.

## `SKILL.md`

The router. Contains a YAML frontmatter block and a markdown body.

Frontmatter fields - see `@command.md` for the full table (skills and commands share the same frontmatter schema). The most relevant for skills:

- `name` (string, kebab-case, <=64 chars) - falls back to the folder name.
- `description` (recommended) - drives auto-invocation. Must include explicit triggers AND a "Do NOT use" clause.
- `disable-model-invocation` (boolean) - `true` makes the skill user-only.
- `allowed-tools` - pre-approved tools while the skill runs.
- `context: fork` + `agent` - run in an isolated subagent context.

Body conventions in this framework:

- Pure router. No business logic. Describe the action table, the default flow, transversal rules, references, and assets.
- Hard cap: 500 lines. Split into references when exceeded.
- Action table maps `#` + slug to role + input.
- `Default flow` line states the canonical order (e.g. `01 -> 02 -> 03`).
- Self-skips and side-flows are stated explicitly.

## `actions/`

One file per action, numbered when sequence matters: `01-<slug>.md`, `02-<slug>.md`, ...

Each action file has exactly these four sections:

- `## Inputs` - bullet list of named fields with type + one-line description. Mark `(required)` / `(optional)`.
- `## Outputs` - concrete artifact example (code block, table, or YAML shape).
- `## Process` - numbered imperative steps. Reference templates via `@<path>`. Steps that consult a reference cite it via `@<path>` only on the step that needs it.
- `## Test` - one sentence describing how to verify the action's intent: a command to run, a check on the produced artifact, or an observable side-effect.

Optional `## Depends on` section between Outputs and Process when the action requires upstream slugs.

Tests must be real-execution: status 200, artifact written, MCP responding, file on disk. Never a mocked `*.test.js`.

## `assets/`

Files actions COPY or INJECT. Templates, fixed JSON snippets, ID tables. Referenced from actions via `@<path>` so the resolver inlines them at runtime.

Asset paths are stable; never inline asset content inside an action.

## `references/`

Documents actions READ when they need the knowledge. Schemas, cheatsheets, naming conventions, glossary entries. One-level deep: a reference must not chain to another reference.

Cited from action `## Process` steps via `@<path>` only when that step needs the knowledge. Plain mentions belong in SKILL.md's `## References` catalog.

## `scripts/`

Skill-local executables invoked from action `## Process` steps. Never inline `curl`/`fetch` calls in an action body - put them in a script and call it via `node scripts/<slug>.js`, `bash scripts/<slug>.sh`, etc.

Skill secrets (`.env`, `.env.local`) live inside the skill folder, never at repo root, always gitignored.

## `evals/scenarios.json`

Required for auto-trigger skills (`disable-model-invocation: false`, the default). Minimum 3 entries:

```json
[
  { "prompt": "<realistic user message>", "expect_action": "<slug or null>" }
]
```

`expect_action: null` means the skill must NOT trigger for that prompt. Use both positive and negative cases.

Manual-only skills (`disable-model-invocation: true`) skip evals.

## Naming

### Skill names

Two valid patterns, one per domain type.

**Tool domain - singular noun.** Use when the skill targets a specific external tool, API, or platform: `slack`, `notion`, `github`, `gmail`, `stripe`, `linear`, `calendar`. Rationale: users name the tool when they want the skill.

**Activity domain - action verb.** Use when the skill captures a practice independent of any single tool: `review`, `plan`, `test`, `refactor`, `debug`, `implement`. Rationale: users describe the verb they want performed.

### Action names (files inside `actions/`)

- Kebab-case verb phrase: `post-message`, `run-tests`, `analyze-logs`.
- Numbered prefix (`01-`, `02-`) when either applies:
  - Execution order is strict (sequential flow), OR
  - Visual grouping by family improves readability at a glance (e.g. setup -> run -> verify -> cleanup).
  In both cases, the slug used everywhere else (SKILL.md action table, `evals/scenarios.json` `expect_action`) is the name without the prefix - validators strip `^\d+-` automatically.
- Avoid vague names: `helper`, `utils`, `main`, `do-stuff`.

### Action table numbering in SKILL.md

The `## Available actions` table in SKILL.md MUST always number entries (`01`, `02`, ...) even when the action files themselves are not prefixed. The numbers are lint anchors used by `scripts/validate-actions.js` to cross-reference; they do not imply execution order unless the skill is sequential.

### Hard constraints (Anthropic spec)

- SKILL.md frontmatter `name`: lowercase, letters/digits/hyphens only, <= 64 chars. Reserved words forbidden: `anthropic`, `claude`.
- SKILL.md frontmatter `description`: <= 1024 chars, non-empty, third person, no XML tags.

### Language

Skills are written in **English only** - frontmatter, body, action files, references, assets, and any output blocks the skill emits at runtime. This holds regardless of the conversation language. Rationale: portability across repos and teams, and consistency with every existing skill in the canon.

### Anti-patterns

- Redundant prefixes: `skill-slack`, `claude-review`, `ai-planner`.
- Vague nouns: `helper`, `utils`, `tools`, `documents`, `data`.
- Mixed patterns inside the same skill collection (e.g. both `slack-post-creator` and `slack` - merge them).
- Gerund form for activity domains (`reviewing`, `planning`) - prefer action verbs (`review`, `plan`).
- Tool prefix for an activity that isn't tool-specific (`slack-review` for code review is wrong; `review` is correct).

### Collision check before creating a skill

1. List installed skills via the AI tool's native discovery mechanism and scan for any existing skill whose description overlaps.
2. If two skills could trigger on the same phrase, one of them is wrong - merge, rename, or tighten the descriptions.
3. When in doubt, ask the user.
