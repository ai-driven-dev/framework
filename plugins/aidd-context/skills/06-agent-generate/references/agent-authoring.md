# Agent authoring

The constraints every generated agent satisfies. An agent is a focused role with its own system prompt, run in a fresh context, returning only a result to its caller.

## Rules

| Id | Rule | Why |
| --- | --- | --- |
| A1 | One agent, one responsibility, self-contained in one file per target. | A workflow belongs in a skill. |
| A2 | Take the concern from the caller's brief, and name no skill, agent or companion file. | A generic agent serves every caller. |
| A3 | Frontmatter holds `name` and `description`, plus `model` only when the user names one, and keeps each field an existing agent sets. | The host gives a new agent its tools and model by default, and a field already set restricts on purpose. |
| A4 | `description` is third person, what the agent does, then `Use to` and when to call it. | The caller picks an agent by its description. |
| A5 | `# Role` is one sentence: the single responsibility. | The role is read first. |
| A6 | `# Behavior` lists bounded capabilities and constraints, one per bullet, and states what the agent keeps unchanged or leaves to the caller. | An agent without a boundary drifts into the caller's work. |
| A7 | `# Output` states how concise the result is, then its return format in a fenced block, empty fields omitted. | The caller parses the result. |
| A8 | Write in English, short imperative sentences, one idea each. | The prompt is read by a model. |

## Naming

| Constraint | Example |
| --- | --- |
| Short, a single word where possible | `executor`, `reviewer`, `explorer` |
| The role is clear at a glance | `validator` checks, it does not fix |
| Three options proposed, the user picks | - |
