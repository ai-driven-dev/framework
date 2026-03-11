---
name: 'aidd:01:generate_rules'
description: 'Generate or modify coding rules manually or auto-scan the codebase to propose rules'
argument-hint: 'Rule topic to write, or ''auto'' to scan codebase and propose rules'
---

# Generate Rules

## Goal

Generate or modify coding rules, either from user input (manual) or by scanning the codebase (auto).

## Outcome

Create structured markdown rule (.mdc or .md depending on the IDE) files with proper front-matter and content, plus IDE bridge files.

## Resources

### Template

```markdown
@aidd_docs/templates/aidd/rule.md
```

### IDE Mapping

Mandatory mapping for IDE integration (file paths, naming, extensions):

```md
@.claude/rules/04-tooling/ide-mapping.md
```

## Context

### User input

```text
$ARGUMENTS
```

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
@.claude/rules/01-standards/1-rule-writing.md
```

### Rule file structure

```markdown
@.claude/rules/01-standards/1-rule-structure.md
```

## Steps

### Step 1: Detect mode

- If `$ARGUMENTS` is "auto" or "scan" → **Auto mode** (Step 2A)
- Otherwise → **Manual mode** (Step 2B)

### Step 2A: Auto mode — Scan codebase

1. Scan project: source files, configs, dependencies, directory structure
2. Identify patterns, conventions, tech stack usage, and existing rules
3. Propose a complete rules architecture:
   - List categories and rule files
   - Show groups and sub-groups per file
   - Display proposed file tree
4. **Wait for user approval** before proceeding
5. → Go to Step 3

### Step 2B: Manual mode — User-guided

1. Remind project context: tech stack, versions, architecture, existing rules
2. Define categories, 1 file per category
3. Look for existing rules to update
4. Plan the new rule(s) structure:
   - File
   - Define groups and sub-groups
   - Display proposed architecture
5. **Wait for user approval** before proceeding
6. → Go to Step 3

### Step 3: Generate

Generate the rules based on the template, following the IDE mapping conventions for file path, naming and extension.
