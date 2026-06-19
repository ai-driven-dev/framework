# Skill authoring

The contract every generated skill must satisfy. These rules govern the CLIENT skill written into the user's workspace. This skill (`skill-generate`) obeys them too. It is its own reference implementation.

## Rules

- **R1.** SKILL.md is a pure router: description + action table + transversal rules. Zero business logic.
- **R2.** One skill = one domain. A tool domain uses a singular noun (`slack`). An activity domain uses an action verb (`review`). See `## Naming`.
- **R3.** References one level deep. A reference never `@`-chains another reference.
- **R4.** SKILL.md <= 500 lines. If exceeded, split into references.
- **R5.** `description` states what + when. Third person, <= 1024 chars, no XML. Conventions:
  - All "when" lives here, not in the body.
  - Triggers explicit and slightly pushy. The model under-triggers, so over-list.
  - Lead with the plain artifact name. Parentheses for an inline definition, not dashes.
  - Optionally a short `Not for <X>` clause, only when a sibling skill could mis-trigger.
- **R6.** Zero duplication. One fact, one home. Actions cite a shared file via `@<path>` instead of restating it.
- **R7.** `references/` = documents to READ and apply in place. `assets/` = files to COPY, INJECT, or fill in per run. A template, checklist, or form is an asset, not a reference, because each run instantiates it.
- **R8.** Every action follows the action anatomy (below) and carries a `## Test`.
- **R9.** Omit any optional section that would be empty. Never write a placeholder like `## External data` + `None.`.
- **R10.** Generated skills are English only (frontmatter, body, actions, references, assets), regardless of conversation language.
- **R11.** One idea per sentence. Split a sentence that runs past one line. Exceptions: the single-line `description` and table rows.
- **R12.** One file = one artifact. A reference or asset holds a single coherent thing: one checklist, one template, one criteria set. When a file accumulates several independently reusable artifacts, split them so each is cited and reused alone. Prefer this split over bundling, even when the combined file is short.

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
- A manual-only flag makes the skill user-only. The exact frontmatter key is per tool.
- Body: pure router. The action table maps each `#` and slug to a role and input. State the flow (a sequential chain or a trigger-to-action map). Self-skips stated explicitly.

The `name` field is NOT the invocation token. The host builds the address from the plugin and folder, each in its own scheme. A colon or prefix in `name` breaks loading on some hosts. In prose, refer to a skill as `plugin:folder`, never `plugin:folder:action`.

## Naming

- **Tool domain, a singular noun**: `slack`, `notion`, `stripe`. Users name the tool.
- **Activity domain, an action verb**: `review`, `plan`, `test`. Users name the verb.
- Action files: kebab-case verb phrase (`post-message`, `run-tests`). Add a numbered prefix when order is strict or family grouping aids reading. The slug used elsewhere is the name without the prefix.
- Avoid: redundant prefixes (`skill-slack`), vague nouns (`helper`, `utils`), gerunds (`reviewing`), tool prefix on a tool-agnostic activity.

### Collision check

Before creating a skill, list installed skills via the tool's native discovery and scan for description overlap. If two skills trigger on the same phrase, one is wrong, so merge, rename, or tighten. When in doubt, ask the user.
