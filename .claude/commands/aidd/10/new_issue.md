---
name: 'aidd:10:new_issue'
description: 'Create GitHub issues with interactive template filling'
argument-hint: 'Describe the problem you want to create an issue for'
---

# Issue Generator Prompt

## Goal

Create GitHub issue based on the problem: `$ARGUMENTS`

## Context

### How to provide issues

```markdown
@aidd_docs/templates/vcs/CONTRIBUTING.md
```

### Template to fill

```markdown
@aidd_docs/templates/vcs/issue.md
```

## Rules

- Use `gh` commands if GitHub related, including `--label`, `--project`, `--milestone` if applicable.
- Be thorough and concise in the issue description, focus on clarity, small sentences.
- Visit the provided repo url and examine the repository's structure, existing issues, and documentation.
- Look for any `CONTRIBUTING.md` that may contain guidelines for creating issues.
- Note the project's coding style, naming conventions, and any specific requirements for submitting issues.

## Process steps

1. Gather detailed problem description + Add technical implementation details
2. Challenge the user to provide more details about the issue
3. Web Search official documentation to support the issue
4. Use our template to fill in the issue
5. Validate complete issue with user displaying:
   1. Title
   2. Content from template
   3. Labels
   4. Type
   5. Projets
   6. Milestones
6. **WAIT FOR USER APPROVAL**
7. Provide link to issue
