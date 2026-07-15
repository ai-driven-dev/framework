# Skill authoring

The contract every generated skill must satisfy. These rules govern the CLIENT skill written into the user's workspace. This skill (`skill-generate`) obeys them too. It is its own reference implementation.

## Rules

- **R1.** SKILL.md is a pure router: the flow schema, the action table, the transversal rules, and the line telling the host to read an action's file before running it. Zero business logic. Every destination, criterion, or per-case rule lives in an action or a reference, never here.
- **R2.** One skill = one domain. A tool domain uses a singular noun (`slack`). An activity domain uses an action verb (`review`). See `## Naming`.
- **R3.** References may nest one directory deep when the group is a load boundary, the files one path pulls together (onboard's `state/`, `order/`, `run/`). Flat when there is no boundary to draw. No deeper, and a reference still never `@`-chains another reference.
- **R4.** Budget what one run reads, not a file's size. The always-on surface is the `description` alone (R14). A given invocation reads SKILL.md plus the actions and references its path pulls in, nothing more. Measure a path by running its files through a tokenizer. The router sits on every path, so it stays the leanest file, not the heaviest.
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
- **R13.** Includes are explicit and scoped. Cite an include with its `@<path>` alone inside a fenced ```<lang> block, never inline in prose. Naming: a global include (imported from SKILL.md, used skill-wide) takes no prefix; an include used by only one action is prefixed with that action's slug (e.g. `research-checklist.md`). SKILL.md lists only the global includes; an action-specific include is cited only from its own action.
- **R14.** The `description` is the only content loaded when the skill is not invoked. Nothing else may earn a place there. The body, actions, references, and assets are all on demand, read only on a path that needs them.
- **R15.** Split a file from another only when some path needs one without the other, or a part is reused elsewhere. Content that always loads together, used in one place, stays one file. This bounds R12: split for independent reuse, never split what a single path always reads as a whole.

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
- `argument-hint` when supported or in plugin source and the skill has two or more actions: the action slugs joined with ` | `, matching the files in `actions/`. When the actions are not all independent entry points, name the user's cases instead (project-memory's `setup | refresh | rewire`), which the hook leaves hand-written. Omit it for one-action skills.
- A manual-only flag makes the skill user-only. The exact frontmatter key is per tool.
- Body: pure router. A flow schema (a mermaid diagram for a loop or branch, a one-line chain when strictly sequential), then an action table mapping each `#` and slug to what it does. An action's input lives in its own `## Input`, never a router column. Self-skips stated explicitly.

The `name` field is NOT the invocation token. The host builds the address from the plugin and folder, each in its own scheme. A colon or prefix in `name` breaks loading on some hosts. In prose, refer to a skill as `plugin:folder`, never `plugin:folder:action`.

## Naming

- **Tool domain, a singular noun**: `slack`, `notion`, `stripe`. Users name the tool.
- **Activity domain, an action verb**: `review`, `plan`, `test`. Users name the verb.
- Action files: kebab-case verb phrase (`post-message`, `run-tests`). Add a numbered prefix when order is strict or family grouping aids reading. The slug used elsewhere is the name without the prefix.
- Avoid: redundant prefixes (`skill-slack`), vague nouns (`helper`, `utils`), gerunds (`reviewing`), tool prefix on a tool-agnostic activity.

### Collision check

Before creating a skill, list installed skills via the tool's native discovery and scan for description overlap. If two skills trigger on the same phrase, one is wrong, so merge, rename, or tighten. When in doubt, ask the user.
