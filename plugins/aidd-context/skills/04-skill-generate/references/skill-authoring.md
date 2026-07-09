# Skill authoring

The contract every generated skill must satisfy. These rules govern the CLIENT skill written into the user's workspace. This skill (`skill-generate`) obeys them too. It is its own reference implementation.

## Rules

- **R1.** SKILL.md is a pure router: a tiny title, the chaining schema, the action table, and transversal rules (see `## SKILL.md`). Zero business logic.
- **R2.** One skill = one domain. A tool domain uses a singular noun (`slack`). An activity domain uses an action verb (`review`). See `## Naming`.
- **R3.** References may nest in sub-folders (`references/<group>/`) so a step loads only what it needs. A reference still never `@`-chains another reference. Split a file from another only when some execution path needs one without the other; content that always co-loads stays one file.
- **R4.** SKILL.md <= 500 lines. If exceeded, split into references.
- **R5.** `description` states what + when. Third person, no XML. Conventions:
  - **Two lines max, straight to the point.** Target ~240 characters; never more than a short paragraph. Length serves recall, not completeness. The hard ceiling is 1024 chars, not a goal.
  - Lead with a verb naming what the skill produces (`Generate a rule...`, `Audit a codebase...`), not a noun phrase.
  - All "when" lives here, not in the body. State it as `Use when the user wants to <intents>`. List distinct triggers (the model under-triggers, so cover the real ones), but never pad with near-duplicate phrasings.
  - Optionally one short `Not for <X>` clause to fend off a sibling that could mis-trigger, describing the overlap in plain words.
  - Never name another skill, and never include a `/command` token: slash commands are tool-native, the host generates them.
  - Parentheses for an inline definition, not dashes.
  - Never use a colon or an em dash in the description. Split the thought into two sentences instead.
- **R6.** Zero duplication. One fact, one home. Actions cite a shared file via `@<path>` instead of restating it.
- **R7.** `references/` = documents to READ and apply in place. `assets/` = files to COPY, INJECT, or fill in per run. A template, checklist, or form is an asset, not a reference, because each run instantiates it.
- **R8.** Every action follows the action anatomy (below) and carries a `## Test`.
- **R9.** A section earns its content or is omitted. State each section's qualify bar and describe the behavior it captures, not a slot to fill. An entry that fails the bar is dropped, never invented to occupy the row. Never write `## External data` + `None.`, nor mint a decision, criterion, or resource just because the template offers it. A template's section set is closed: an instance fills or omits the defined sections and never adds, renames, or reorders one.
- **R10.** Generated skills are English only (frontmatter, body, actions, references, assets), regardless of conversation language.
- **R11.** One idea per sentence. Split a sentence that runs past one line. Exceptions: the single-line `description` and table rows.
- **R12.** One file = one artifact. A reference or asset holds a single coherent thing: one checklist, one template, one criteria set. When a file accumulates several independently reusable artifacts, split them so each is cited and reused alone. Prefer this split over bundling, even when the combined file is short.
- **R13.** Includes are explicit and scoped. An **import** (content pulled into context) is cited with its `@<path>` alone inside a fenced ```<lang> block. A **pointer** (read-this-reference in a step) may cite `@<path>` inline in prose. Either uses the reference's full path, including a nested `references/<group>/file.md`. Naming: a global include (imported from SKILL.md, used skill-wide) takes no prefix; an include used by only one action is prefixed with that action's slug (e.g. `research-checklist.md`). SKILL.md lists only the global includes; an action-specific include is cited only from its own action.
- **R14.** Bodies use telegraphic notation: tables, `→` for a linear chain, fragments over sentences, no filler. Never at the cost of a load-bearing condition. A branch, edge case, or if/then stays precise. Use a Mermaid diagram only for branching logic, never for a linear chain.

## Action anatomy

One file per action, numbered when sequence matters (`01-<slug>.md`). Exactly these parts, in order:

- `# NN - Title` + one sentence: what the action does.
- `## Input`: OPTIONAL, free-form prose/bullets. Omit when none. No frozen YAML/text data block.
- `## Output`: MANDATORY, one line or a tiny inline shape. No frozen YAML/text data block.
- `## Process`: small numbered steps, one responsibility each. Conventions:
  - Lead each step with a bold one-word label (e.g. **Detect.**), then short imperative sentences. Prefer two sentences over a semicolon.
  - Use sub-bullets for a branch, a condition ("if X, then Y"), or a loop back to an earlier step.
  - Keep steps tool-agnostic. Per-tool specifics (paths, formats, conversions) live in the reference.
  - Flow decisions live in the step, not behind a reference pointer. References hold the data the steps look up.
  - Use `→` only for a flow chain, never `->`.
- `## Test`: a bullet list of plain checks, each stated plainly: a command, an artifact check, or an observable side-effect. Deterministic where possible. For a model-driven action, assert an observable property of the output (its structure, a required field), not an exact value. Real execution, never a mocked `*.test.js`.

## SKILL.md

The router: YAML frontmatter + markdown body.

- `name` (kebab-case, <= 64 chars) MUST equal the skill's folder name. No colon, slash, dot, plugin prefix, or namespace. Reserved words forbidden: `anthropic`, `claude`. Regex `^[a-z0-9]+(-[a-z0-9]+)*$`.
- `description`: per R5.
- `argument-hint` when supported or in plugin source and the skill has two or more actions: action names only, joined with ` | `, matching the files in `actions/`. Omit it for one-action skills.
- A manual-only flag makes the skill user-only. The exact frontmatter key is per tool.
- Frontmatter carries official keys only (`name`, `description`, `argument-hint`, the host manual-only flag). Never invent a flag the model must interpret; the body carries mode, not a made-up key.
- Body order: a tiny `# Title`, the chaining schema, the action table, then the transversal rules. No restated intro sentence; the `description` already states the what.
  - **Chaining schema.** A pipeline shows a one-line arrow schema, `a → b → c ↺` (`↺` marks a loop back). A menu shows the line `Pick one per request.` and no schema. The mode reads itself; no field states it.
  - **Action table.** Columns `# | Action | Does`; `Does` is verb-led and telegraphic (verb + object). A menu drops the `#` column. No `Input` column: an action's input lives in its own `## Input`.
- Standing rule for every skill: read an action's file just before running it, not only the router table. Stated here once, never repeated in a SKILL.md body.

The `name` field is NOT the invocation token. The host builds the address from the plugin and folder, each in its own scheme. A colon or prefix in `name` breaks loading on some hosts. In prose, refer to a skill as `plugin:folder`, never `plugin:folder:action`.

## Naming

- **Tool domain, a singular noun**: `slack`, `notion`, `stripe`. Users name the tool.
- **Activity domain, an action verb**: `review`, `plan`, `test`. Users name the verb.
- Action files: kebab-case verb phrase (`post-message`, `run-tests`). Add a numbered prefix when order is strict or family grouping aids reading. The slug used elsewhere is the name without the prefix.
- Avoid: redundant prefixes (`skill-slack`), vague nouns (`helper`, `utils`), gerunds (`reviewing`), tool prefix on a tool-agnostic activity.

### Collision check

Before creating a skill, list installed skills via the tool's native discovery and scan for description overlap. If two skills trigger on the same phrase, one is wrong, so merge, rename, or tighten. When in doubt, ask the user.
