---
name: audit
description: Perform deep codebase analysis for technical debt and improvements
argument-hint: Scope to audit (optional - defaults to full codebase)
model: opus
---

# Codebase Audit Prompt

## Ressources

### Coding rules

```markdown
@{{TOOLS}}/rules/
```

### Template

```markdown
@{{TOOLS}}/plugins/aidd-dev/skills/04-review/assets/code-review-template.md
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
3. Output detailed audit report based on template in `{{DOCS}}/tasks/audits/<yyyy>_<mm>_<slug>.md`
