---
name: 'aidd:09:audit'
description: 'Perform deep codebase analysis for technical debt and improvements'
argument-hint: 'Scope to audit (optional - defaults to full codebase)'
---

# Codebase Audit Prompt

## Ressources

### Coding rules

```markdown
@.claude/rules/
```

### Template

```markdown
@aidd_docs/templates/dev/code_review.md
```

## Goal

Conduct comprehensive codebase audit to identify quality issues and improvement opportunities.

Code to Analyze: "$ARGUMENTS" (default: entire codebase)

## Rules

- Never suppose dead code without dedicated tools to identify it

## Elements to check

- Code not needed anymore & Dead code
- Too much complexity
- Irrelevances in existing codebase
- Code duplication & Reused effectively
- Error handling best practices
- Length for files, functions, components...
- Lack of VERY IMPORTANT tests

## Process steps

1. Scan source code for duplication patterns
2. For each rules, check compliance and document findings
3. Output detailed audit report based on template in `aidd_docs/tasks/audits/<yyyy>_<mm>_<slug>.md`
