---
name: 'aidd:01:generate_command'
description: 'Generate optimized, action-oriented prompts using best practices and structured template'
argument-hint: 'The command details to generate the prompt for'
---

# Generate Optimized Prompt Command

## Context

- Must follow structured template
- User needs ultra-optimized prompts for specific tasks

### Template

```markdown
@aidd_docs/templates/aidd/command.md
```

### IDE Mapping

Mandatory mapping for IDE integration (file paths, naming, extensions):

```markdown
@.claude/rules/04-tooling/ide-mapping.md
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

Generate a production-ready prompt that maximizes LLM performance argument.

## Rules

- Make sure this is the best prompt ever written matching good practices
- Clear role definition with specific expertise domains
- Explicit constraints and boundaries
- Step-by-step process with decision trees
- When needed to execute command line, use the `!` backtick pattern

## Process Steps

1. Ultra think about the prompt we are trying to achieve.
2. Analyze task → Extract core objective and constraints
3. Using the SDLC Phase Taxonomy above, propose the best phase for this command.
4. If unsure, check if already exists
5. Check if the prompt already exists in `@.claude/commands/**`.
   - If it exists, analyze it for improvements.
   - If not, create a new prompt file.
6. Challenge it is necessary, then summarize it to user.
7. Valide with user.
8. Output newly generated prompt following the IDE mapping conventions for file path and naming.
9. Add the new prompt into the `@aidd_docs/CATALOG.md` to keep documentation up to date.

## Validation checklist

- [ ] Prompt is clean, minimal, focused on action
