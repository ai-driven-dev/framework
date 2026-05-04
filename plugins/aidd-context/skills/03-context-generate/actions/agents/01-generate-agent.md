---
name: generate_agent
description: Generates a customized agent based on user-defined parameters.
model: sonnet
---

# Goal

Generate a specialized agent template tailored to specific user requirements.

## Context

### Coordination with other agents

```markdown
@../../references/agents-coordination.md
```

### Agent template

```markdown
@../../assets/agents/agent-template.md
```

### IDE Mapping

Apply tool-native conventions for agent file paths, naming, and extensions.

## Rules

- Input and Output for the agent MUST be ULTRA concise and precise.
- Ask clarifying questions if the user's request is ambiguous or lacks detail.
- When mentioning templates in `aidd_docs`, always provide full path

## Instruction steps

1. Ask following questions to the user until you gather all necessary information in agent's template.
   1. Discuss with the user until you have a clear understanding of the agent's purpose, tools, and instructions.
   2. Use the gathered information to fill in the agent template.
2. Review the generated agent to ensure it is straightforward with 0 ambiguity.
   1. Affect a note between 1 and 10 to the generated agent based on its relevance and completeness.
3. **Wait for user confirmation before finalizing the agent.**
4. Propose 3 real first names for the agent, each name must be short and catchy, making sense with the agent's purpose (could be word game, acronym, etc.).
5. Provide the completed agent template as the final output, written to the AI tool's native agents directory as `<generated-agent-name>.md`.
6. Add the new prompt into the `@aidd_docs/CATALOG.md` to keep documentation up to date.
