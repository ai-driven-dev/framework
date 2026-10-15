# Agent authoring

The contract every generated agent must satisfy. An agent is a focused role with its own system prompt, run in a fresh context.

## Rules

- **R1.** One agent, one role. A single, clear responsibility.
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
- `# Guardrails`: behavioral boundaries.
- `# Skills you may invoke`: list allowed recipes by canonical `/plugin:folder` address; verify availability before invocation.
- `# Definition of Ready` / `# Definition of Done`: start and finish gates.
- `# Decisions in scope` / `# Decisions out of scope`: what it may decide, what it must defer.
- `# Handoffs`: who it returns to.
