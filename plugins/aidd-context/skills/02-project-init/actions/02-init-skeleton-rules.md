---
name: init-skeleton-rules
description: Generate the rules/ skeleton with 10 empty numbered directories
model: sonnet
---

# Init Skeleton Rules

Generate the `rules/` directory skeleton with 10 empty numbered directories following the SDLC phase taxonomy.

## Goal

Create an empty, numbered `rules/` directory structure so that future rules are organized by phase from the start.

## Rules

- Create directories only — do not create any files inside them
- Follow the SDLC phase taxonomy exactly
- Do not overwrite existing directories or files

## Steps

1. Check if `rules/` directory already exists in the project root:
   - If it exists, list existing subdirectories and inform the user
   - If it does not exist, proceed to step 2
2. Create the following 10 numbered subdirectories inside `rules/`:

```text
rules/
├── 00-architecture/
├── 01-standards/
├── 02-context/
├── 03-plan/
├── 04-code/
├── 05-review/
├── 06-tests/
├── 07-documentation/
├── 08-deploy/
├── 09-other/
```

3. Inform the user which directories were created.
4. Suggest next steps: use `generate_rules` to populate rules in the appropriate category.
