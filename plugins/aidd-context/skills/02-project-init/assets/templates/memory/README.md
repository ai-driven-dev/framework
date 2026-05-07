# memory/ - Project Memory Templates

## What is memory/?

`memory/` holds structured context files that Claude reads at the start of each session. Each file documents a specific dimension of the project so the assistant does not need to rediscover it.

## Who reads it?

These files are loaded by the `<aidd_project_memory>` block in `AGENTS.md`. Claude reads them automatically on the first message of each conversation.

## How to maintain it?

- One file per concern (architecture, testing, VCS, etc.)
- Keep each file under 200 lines - favour pointers to code over copying code
- Update a file whenever the underlying reality changes (new stack decision, changed test strategy, etc.)
- Never add personal notes or TODO items - memory files describe current state, not future intent

## Subdirectories

- `backend/` - optional context specific to server-side concerns (API contracts, database schema conventions, inter-service communication)
- `frontend/` - optional context specific to client-side concerns (UI patterns, form handling, design tokens)

Drop the subfolder you do not need for your project type.
