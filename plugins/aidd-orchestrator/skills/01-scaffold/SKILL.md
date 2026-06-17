---
name: 01-scaffold
disable-model-invocation: true
description: Sequencing tutorial that launches the right skills, in order, to turn a project idea into a running skeleton.
---

# Skill: scaffold

A tutorial for you (the AI): take a project idea to a running skeleton by launching the right skills, in order. You orchestrate; you build nothing yourself.

Run each step, wait for it to return, then move to the next:

1. **Product context** - `run skill "aidd-pm:03-prd"` (skip if a product brief already exists).
2. **Repository** - `run skill "aidd-vcs:00-repo-init"`.
3. **Bootstrap** - `run skill "aidd-context:01-bootstrap"`: designs the stack into `INSTALL.md`, then builds the skeleton. The bulk of the work.
4. **AIDD context** - `run skill "aidd-context:02-project-init"`.

Each skill validates its own work; do not re-verify here. When the last returns, report what was built.

## Rules

- **You sequence, you don't build.** Every step is another skill's job.
- **Resume-aware.** If an artifact already exists (repository, `INSTALL.md`, context), skip its step and continue from the first one still missing.
