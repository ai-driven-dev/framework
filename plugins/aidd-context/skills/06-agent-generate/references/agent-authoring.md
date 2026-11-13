# Agent authoring

The contract every generated agent must satisfy. An agent is a focused role with its own system prompt, run in a fresh context.

## Rules

- **R1.** One agent, one behavior, self-contained in one file per target. Workflows belong in skills; omit skill permission lists and required companion files.
- **R2.** Frontmatter: `name` and `description` are required. `model` is optional. The description states what the agent does and when to use it.
- **R3.** The body is the system prompt. Required: `# Role` and `# Behavior` (bounded capabilities and constraints). Optional sections: see `## Body shape`. Concise and imperative.
- **R4.** English only, regardless of conversation language.
- **R5.** One idea per sentence. Split a sentence that runs past one line. Exceptions: table rows.

## Naming

- Short and catchy, a single word where possible: `executor`, `reviewer`, `auditor`.
- Fits the role at a glance. Propose three options for the user to pick.

## Body shape

Short imperative sentences. Optional sections, added only when they earn their place:

- `# Inputs`: what it receives.
- `# Outputs`: what it returns.
