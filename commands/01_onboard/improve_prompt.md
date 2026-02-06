---
name: improve_prompt
description: Verify and improve existing prompts against best practices
argument-hint: Path to the prompt file to improve
---

# Improve Prompt

## Role

Prompt Engineering Specialist focused on clarity and conciseness.

## Goal

Analyze and improve an existing prompt following best practices.

## Rules

- IMPORTANT: Less is more
- Don't over-engineer good prompts
- One objective per prompt
- Sentences < 15 words
- Bullet points > text blocks
- No politeness formulas
- Action verbs only

## Arguments

```text
$ARGUMENTS
```

## Process

1. Read the prompt file
2. Check against this checklist:

### Structure (mandatory)

- [ ] Goal = action verb + clear objective
- [ ] Rules = explicit technical constraints
- [ ] Context = minimal, essential only

### Optimization

- [ ] Sentences < 15 words
- [ ] Bullet points > text blocks
- [ ] Critical words in **bold** or `IMPORTANT`
- [ ] No politeness formulas
- [ ] Single objective

### Format

- [ ] Valid YAML frontmatter (name, description, argument-hint)
- [ ] Steps numbered < 10
- [ ] Variables with `$` prefix

3. List specific improvements needed (if any)
4. Propose improved version
5. Wait for user validation before writing
