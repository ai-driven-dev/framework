# Naming conventions

## Skill names

Two valid patterns, one per domain type.

### Tool domain - singular noun

Use when the skill targets a specific external tool, API, or platform.

- `slack`, `notion`, `github`, `gmail`, `stripe`, `linear`, `calendar`

Rationale: users name the tool when they want the skill. The noun is the natural trigger phrase.

### Activity domain - action verb

Use when the skill captures a practice independent of any single tool.

- `review`, `plan`, `test`, `refactor`, `debug`, `implement`

Rationale: users describe the verb they want performed. The verb is the natural trigger.

## Action names (files inside `actions/`)

- Kebab-case verb phrase: `post-message`, `run-tests`, `analyze-logs`.
- Numbered prefix (`01-`, `02-`) when either applies:
  - Execution order is strict (sequential flow), OR
  - Visual grouping by family improves readability at a glance (e.g. setup → run → verify → cleanup for a deployment skill).
  In both cases, the slug used everywhere else (SKILL.md action table, `evals/scenarios.json` `expect_action`) is the name without the prefix - validators strip `^\d+-` automatically.
- Avoid vague names: `helper`, `utils`, `main`, `do-stuff`.

## Action table numbering in SKILL.md

The `## Available actions` table in SKILL.md MUST always number entries (`01`, `02`, ...) even when the action files themselves are not prefixed. The numbers are lint anchors used by `scripts/validate-actions.js` to cross-reference; they do not imply execution order unless the skill is sequential.

## Hard constraints (Anthropic spec)

- SKILL.md frontmatter `name`: lowercase, letters/digits/hyphens only, ≤ 64 chars. Reserved words forbidden: `anthropic`, `claude`.
- SKILL.md frontmatter `description`: ≤ 1024 chars, non-empty, third person, no XML tags.

## Language

- Skills are written in **English only** - frontmatter, body, action files, references, assets, and any output blocks the skill emits at runtime. This holds regardless of the conversation language. Rationale: portability across repos and teams, and consistency with every existing skill in the canon.

## Anti-patterns

- Redundant prefixes: `skill-slack`, `claude-review`, `ai-planner`.
- Vague nouns: `helper`, `utils`, `tools`, `documents`, `data`.
- Mixed patterns inside the same skill collection (e.g. both `slack-post-creator` and `slack` coexisting - merge them).
- Gerund form for activity domains (`reviewing`, `planning`) - prefer action verbs (`review`, `plan`).
- Tool prefix for an activity that isn't tool-specific (`slack-review` for code review is wrong; `review` is correct).

## Collision check before creating a skill

1. List installed skills via the AI tool's native discovery mechanism and scan for any existing skill whose description overlaps.
2. If two skills could trigger on the same phrase, one of them is wrong - merge, rename, or tighten the descriptions.
3. When in doubt, ask the user.
