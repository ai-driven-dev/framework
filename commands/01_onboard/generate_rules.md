---
name: generate_rules
description: Generate or modify coding rules for the project's rule-based architecture system
argument-hints:
  - "Which coding rules would you like to generate or update for this project?"
---

# Generate Rules

## Goal

Generate or modify coding rules based on the current project.

## Outcome

Create structured markdown rule (.mdc or .md depending on the IDE) files with proper front-matter and content, plus IDE bridge files.

## Resources

### Template

```markdown
@{{DOCS}}/templates/aidd/rule.md
```

### IDE Mapping

Mandatory mapping for IDE integration (file paths, naming, extensions):

```md
@{{TOOLS}}/rules/04-tooling/ide-mapping.md
```

## Context

### Example rule file structure

```text
03-frameworks-and-libraries/
├── 3-react@19-components-structure.md (globs: ['**.tsx', '**/components/**', ...])
│   ├── Component definition basics
│   ├── Export patterns
│   ├── Props & typing
│   └── Naming conventions
├── ...
```

## Rules

- Be concise, less is more
- If multiple examples, then multiple rule files

### Rule writing standards

```markdown
@{{TOOLS}}/rules/01-standards/1-rule-writing.md
```

### Rule file structure

```markdown
@{{TOOLS}}/rules/01-standards/1-rule-structure.md
```

## Steps

1. Remind project context: tech stack, versions, architecture, existing rules
2. Define categories, 1 file per category
3. Look for existing rules to update
4. Plan the new rule(s) structure:
   - File
   - Define groups and sub-groups
   - Display proposed architecture
5. Project it to the user for validation
6. **Wait for user approval** before proceeding
7. Generate the rules based on the template, following the IDE mapping conventions for file path, naming and extension
