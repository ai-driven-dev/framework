← [framework](../../../../README.md) / [aidd-context](../../README.md)

# 10 - Learn

Distills what a piece of work taught into the project's lasting context. It picks a source, scores each candidate learning, asks the user what to do with each one, writes only the approved lessons, and refreshes the memory block so the next session starts from them.

## When to use

- The user states a lasting rule or convention ("from now on", "always", "going forward").
- A decision is made and worth recording with its rationale.
- Something is deprecated, or a piece of work is worth distilling before moving on.

## When not to use

- For personal or AI-preference reminders. Those belong in user memory, not the project.
- For routine edits, minor fixes, or anything already captured.
- To stand up the memory bank itself. Use `aidd-context:02-project-memory`.

## Requires

An existing memory bank (`aidd_docs/memory/`). If it is missing, run `aidd-context:02-project-memory` first.

## Flow

Four actions, in order:

1. `gather`: pick a source (the conversation, the git history, or one the user names), collect candidates, drop the noise.
2. `assess`: score each candidate from 0 to 10 with a reason, propose a destination, and ask the user what to do with each.
3. `write`: write the lessons the user approved to their destinations.
4. `sync`: refresh the memory block in every context file.

## Destinations

- **Memory**: a fact or convention, into the matching memory file.
- **Decision**: a choice with a rationale, a record in `aidd_docs/memory/internal/decisions/` from `assets/decision-template.md`.
- **Rule**: a convention to enforce, handed to `aidd-context:05-rule-generate`.
- **Skill**: a reusable workflow, handed to `aidd-context:04-skill-generate`.

The score is the brake (bar 6 of 10), and the user decides every item before anything is written.

## Details

See [`SKILL.md`](SKILL.md) and [`actions/`](actions/).
