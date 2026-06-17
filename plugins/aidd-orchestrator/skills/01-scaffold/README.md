← [aidd-orchestrator](../../README.md)

# 01-scaffold

Turns a project idea into a running skeleton by launching the right skills in order. A simple sequencing tutorial for the AI - it owns no logic and builds nothing itself; every step is another skill's job.

> Status: experimental.

## When to use

- Starting a new project you want actually built and running, end to end.

## When NOT to use

- Producing only design or architecture docs (use `aidd-context:01-bootstrap`).
- Adding features or business logic to an existing project.
- Editing context documentation or memory files directly.

## How to invoke

`aidd-orchestrator:01-scaffold`, or say "scaffold a new project".

## What it does

Launches, in order: product context → repository → bootstrap (designs the stack, then builds the skeleton) → AIDD context. Each launched skill validates its own work.

## Technical details

A single `SKILL.md` - no actions, no checklist of its own. See [SKILL.md](SKILL.md).
