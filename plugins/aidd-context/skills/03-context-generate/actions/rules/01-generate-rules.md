---
name: generate_rules
description: Generate or modify coding rules manually or auto-scan the codebase to propose rules
argument-hint: "Rule topic to write, or 'auto' to scan codebase and propose rules"
model: sonnet
---

# Generate Rules

## Goal

Generate or modify coding rules, either from user input (manual) or by scanning the codebase (auto).

## Outcome

Create structured markdown rule (.mdc or .md depending on the IDE) files with proper front-matter and content, plus IDE bridge files.

## Resources

### Template

```markdown
@../../assets/rules/rule-template.md
```

### IDE Mapping

Apply tool-native conventions for rule file paths, naming, and extensions.

```markdown
@../../references/ai-mapping.md
```

## Context

### User input

```text
$ARGUMENTS
```

### Example rule file structure

```text
03-frameworks-and-libraries/
├── 3-react@19-components-structure.md (globs: ['**/*.tsx', '**/components/**', ...])
│   ├── Component definition basics
│   ├── Export patterns
│   ├── Props and typing
│   └── Naming conventions
└── ...
```

## Rules

- Be concise, less is more
- If multiple examples, then multiple rule files
- Frontmatter and tool-specific syntax (extensions, paths, globs) live in the references below

### Rule writing standards

```markdown
@../../references/rule-writing.md
```

### Rule file structure

```markdown
@../../references/rule-structure.md
```

## Steps

### Step 1: Detect mode

- If `$ARGUMENTS` is "auto" or "scan" → **Auto mode** (Step 2A)
- Otherwise → **Manual mode** (Step 2B)

### Step 2A: Auto mode - Scan codebase

1. Scan project: source files, configs, dependencies, directory structure
2. Identify patterns, conventions, tech stack usage, and existing rules
3. Propose a complete rules architecture:
   - List categories and rule files
   - Show groups and sub-groups per file
   - Display proposed file tree
4. **Wait for user approval** before proceeding
5. → Go to Step 3

### Step 2B: Manual mode - User-guided

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
