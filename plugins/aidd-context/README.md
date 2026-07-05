← [aidd-framework](../../README.md)

# aidd-context

Knowledge production plugin for the AI-Driven Development framework.

> Status: stable.

First time? Install with `/plugin install aidd-context@aidd-framework`, then run `aidd-context:00-onboard`.

Covers project bootstrap, the project memory bank, generation of context artifacts (skills, agents, rules, commands, hooks), Mermaid diagrams, learning, project exploration, recipes, and a plain-language onboarding guide.

## Skills

| Bracket ID | Skill          | Description                                                                                                                                                     |
| ---------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [1.0]      | [onboard](skills/00-onboard/README.md)                 | Guide the user through the AIDD flow in plain language and suggest the next step, adapted to installed plugins.            |
| [1.1]      | [bootstrap](skills/01-bootstrap/README.md)             | Design and validate a new project's technical stack through Q&A and multi-agent audit, then output an INSTALL.md. |
| [1.2]      | [project-memory](skills/02-project-memory/README.md)       | Initialize or refresh the project memory bank, and sync it into the AI context files.                              |
| [1.3]      | [context-generate](skills/03-context-generate/README.md) | Generate context artifacts: router-based skills, agents, rules, slash commands, hooks, plugin scaffolds, and plugin marketplaces.                               |
| [1.4]      | [mermaid](skills/09-mermaid/README.md)                 | Generate Mermaid diagrams from markdown using a plan-validate workflow.                                                         |
| [1.5]      | [learn](skills/10-learn/README.md)                     | Capture and score learnings from the conversation or git history, then route the useful ones to memory, a decision record, a rule, or a new skill. |
| [1.6]      | [explore](skills/11-explore/README.md)                 | Survey the project across tooling, context, and codebase, then drill into one axis for a goal.                      |
| [1.7]      | [cook](skills/12-cook/README.md)                       | Maintain the project's `recipes/` how-to sheets: list them, or create and update one from the canonical template.                              |

## Onboarding

New to AIDD, or unsure what to run next? Invoke `aidd-context:00-onboard`. The skill:

1. Reads the project silently: the memory bank, the code and stack, any spec or plan, and which AIDD plugins are installed.
2. Explains in plain language where the project sits in the AIDD flow, suggests the next step as an installed skill, and offers a short numbered menu.
3. Loops back to reading the project after each step so the guidance always reflects the current state.

Onboard adapts to whatever plugins are installed: it suggests by function and discovers the skills that fill each step, so a skill added later shows up on its own.
