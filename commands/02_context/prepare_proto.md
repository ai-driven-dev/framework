---
name: prepare_proto
description: Generate structured prompts for AI prototyping tools (Bolt, Lovable, v0)
argument-hint: brainstorm output or feature brief
---

# Goal

Transform a clarified brief into ready-to-copy prompts for AI prototyping tools.

## Rules

- MVP scope only (3-5 features max)
- Include user context and problem statement
- Generate 3 parallel approaches
- Prompt must enable < 2h proto (AIDD threshold)

## Steps

1. Collect context from $ARGUMENTS or ask user for:
   - Target user (who)
   - Problem to solve (why)
   - Core features (what, 3-5 max)
   - Constraints (technical, UX)
   - Visual references (optional)

2. Generate 3 prompt variants:
   - **Obvious**: standard approach
   - **Minimal**: MVP absolute (1-2 features)
   - **Unconventional**: different angle

3. Format each variant with 5 sections:
   - Context utilisateur
   - Problème à résoudre
   - Fonctionnalités MVP
   - Références visuelles
   - Contraintes non négociables

4. Display prompts ready to copy-paste

## Output

Display formatted prompts in code blocks for easy copy.
