---
name: 'aidd:01:generate_architecture'
description: 'Generate project architecture with agents, skills, coordination diagram, and optional rules/commands for code projects'
argument-hint: 'Project description and domain requirements'
---

# Generate Project Architecture

## Context

### Domain templates

```markdown
@aidd_docs/templates/domain/
```

### Core generators

```markdown
@.claude/commands/aidd/01/generate_agent.md
```

```markdown
@.claude/commands/aidd/01/generate_skill.md
```

### Coordination template

```markdown
@aidd_docs/templates/aidd/agents_coordination.md
```

### IDE Mapping

```markdown
@.claude/rules/04-tooling/ide-mapping.md
```

### Mermaid standards

```markdown
@.claude/rules/01-standards/1-mermaid.md
```

### Command generator

```markdown
@.claude/commands/aidd/01/generate_command.md
```

### Command structure standards

```markdown
@.claude/rules/01-standards/1-command-structure.md
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
10. Update `@aidd_docs/CATALOG.md` with all new elements

## Validation checklist

- [ ] Each agent has a unique, non-overlapping responsibility
- [ ] Each skill is loaded by at least one agent
- [ ] Coordination diagram accurately reflects agent-skill relationships
- [ ] Mermaid diagram follows 1-mermaid.md standards
- [ ] All file paths follow IDE mapping conventions
- [ ] CATALOG.md is updated
- [ ] Domain templates created for each output format
