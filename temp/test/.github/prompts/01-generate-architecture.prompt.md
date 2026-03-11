---
name: 'aidd_01_generate_architecture'
description: 'Generate project architecture with agents, skills, coordination diagram, and optional rules/commands for code projects'
argument-hint: 'Project description and domain requirements'
---

# Generate Project Architecture

## Context

### Domain templates

```markdown
[aidd_docs/templates/domain/](../../aidd_docs/templates/domain/)
```

### Core generators

```markdown
[.github/prompts/01-generate-agent.prompt.md](../../.github/prompts/01-generate-agent.prompt.md)
```

```markdown
[.github/prompts/01-generate-skill.prompt.md](../../.github/prompts/01-generate-skill.prompt.md)
```

### Coordination template

```markdown
[aidd_docs/templates/aidd/agents_coordination.md](../../aidd_docs/templates/aidd/agents_coordination.md)
```

### IDE Mapping

```markdown
[.github/instructions/04-ide-mapping.instructions.md](../../.github/instructions/04-ide-mapping.instructions.md)
```

### Mermaid standards

```markdown
[.github/instructions/01-mermaid.instructions.md](../../.github/instructions/01-mermaid.instructions.md)
```

### Command generator

```markdown
[.github/prompts/01-generate-command.prompt.md](../../.github/prompts/01-generate-command.prompt.md)
```

### Command structure standards

```markdown
[.github/instructions/01-command-structure.instructions.md](../../.github/instructions/01-command-structure.instructions.md)
```

### Arguments

```text
$ARGUMENTS
```

## Goal

Generate project architecture: agents, skills, commands, and a Mermaid coordination diagram.

## Rules

### Universal

- 1 agent = 1 clear responsibility (no overlap between agents)
- 1 skill = 1 reusable workflow (must justify 2-3x repetition)
- Output Mermaid coordination diagram following `agents_coordination` template
- Follow Mermaid standards
- Validate complete architecture plan with user BEFORE generating any file
- Use existing generators for each element (never create files directly)
- Follow IDE mapping conventions for all file paths
- Identify domain resources (brand, vision, conventions) before designing agents

## Steps

1. Analyze existing inventory elements (agents, skills, templates, commands)
2. Analyze project description: extract domains, workflows, team structure
3. Identify domain resources the project relies on (brand guidelines, vision, copywriting conventions, style guides) that commands will need to reference
4. Identify domain templates needed for each output format.
5. Map responsibilities to agents (name, role, scope) ensuring zero overlap
6. Extract repeated workflows as skills each agent will use
7. Generate Mermaid coordination diagram showing: agents, skills they load, communication flows
8. Present diagram + architecture plan (including domain templates) to user for validation
9. On approval, create every items: templates, agents, skills, rules, commands...
10. Update `[aidd_docs/CATALOG.md](../../aidd_docs/CATALOG.md)` with all new elements

## Validation checklist

- [ ] Each agent has a unique, non-overlapping responsibility
- [ ] Each skill is loaded by at least one agent
- [ ] Coordination diagram accurately reflects agent-skill relationships
- [ ] Mermaid diagram follows 1-mermaid.md standards
- [ ] All file paths follow IDE mapping conventions
- [ ] CATALOG.md is updated
- [ ] Domain templates created for each output format
