---
name: generate-skill
description: Generate, modify, and maintain automation skills with sub-actions, references, and test policies. Use whenever the user wants to create a new automation skill, add or edit sub-actions, update references or test policies, restructure execution flow, or convert a manual workflow into a structured skill. Also trigger on "create a skill for...", "automate my...", "add a sub-action to...", "update the references in...", or any mention of building repeatable AI-driven workflows.
---

# Generate Skill

Produces and maintains automation skills — folder structures an AI agent executes end-to-end. A skill is an orchestrator SKILL.md that points to sub-action files and reference files.

## Context

- **Goal**: A complete, tested skill exists at the user's chosen path, ready to use via `/<skill-name>`.
- **Tools required**: File system (read, write, glob, grep). No external APIs needed.
- **Trigger**: Manual — user asks to create or modify a skill.

## What a skill is

```
<skill-name>/
├── SKILL.md                   ← orchestrator (context, rules, execution flow)
├── .env                       ← actual secrets (gitignored)
├── .env.local                 ← how to obtain each secret (committed)
├── sub-actions/
│   ├── 01-<slug>.md           ← atomic operations
│   └── ...
└── references/
    └── <topic>.md             ← documentation files
```

- **SKILL.md orchestrates.** Context, transversal rules, execution flow. No implementation details.
- **Sub-actions are files.** Each is one atomic, stateless operation.
- **References are documentation.** Each explains a domain, a tool, or a convention. Referenced directly from SKILL.md. No fixed format — use whatever structure fits the content (tables, lists, prose, code samples). One file per knowledge domain, self-contained and readable.
- **Every sub-action has a test policy.** Assertion, exit condition, retry loop, fallback.
- **Single source of truth.** Orchestration → `SKILL.md`, implementation → `sub-actions/`, documentation → `references/`, secrets → `.env` / `.env.local`.
- **Numbering**: two-digit prefix = execution order. Same number = parallel.
- **Environment files**: `.env` (secrets, gitignored) + `.env.local` (instructions, committed). Omit if no secrets needed.

## Transversal rules

1. **No assumptions**: IF information is missing THEN ask the user. Never guess.
2. **No skipping validation**: IF a challenge or validation step fails THEN loop back and fix. Do not proceed.
3. **Single source of truth**: IF a piece of information already exists in the skill THEN update it in place. Never duplicate.
4. **Modify flow**: IF the user wants to modify an existing skill THEN follow the modify flow below instead of the generate flow.

## Execution flow

1. `sub-actions/01-pre-flight.md`
2. `sub-actions/02-understand-workflow.md`
3. `sub-actions/03-decompose.md`
4. `sub-actions/04-plan-and-challenge.md`
5. `sub-actions/05-write-files.md`
6. `sub-actions/06-execute-and-test.md`
7. `sub-actions/07-done.md`

## References

- `references/skill-template.md` — Template for generating SKILL.md orchestrators
- `references/sub-action-template.md` — Template for sub-action files

## Modify flow

When the user wants to modify an existing skill (not create a new one):

1. Read the file tree: `ls <skill-name>/` and relevant files.
2. **Search before writing.** Grep the entire skill for the information being added or changed. Determine the canonical location: orchestration → `SKILL.md`, implementation → `sub-actions/`, documentation → `references/`, secrets → `.env` / `.env.local`.
3. Map the user's request to specific files. Update at the canonical location — never duplicate.
4. Edit only affected files.
5. Renumber sub-actions if insertion/deletion changed order.
6. Verify downstream sub-actions still have valid input contracts.
7. Present the diff before saving.
