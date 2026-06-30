# 01 - Read project

Read the project once, **silently**, into a reusable snapshot. No questions, no writes, no visible output.

## Input

The project root, the current working directory.

## Output

A silent, reusable snapshot, **never printed**: every signal in `@../references/signals.md`, a **session ledger** of which steps were run or skipped this session (empty on the first read), the installed AIDD plugins and skills each with its description, and — when memory is synced — the project's purpose, stack, and shape from its brief.

## Process

1. **Read.** Capture every signal in `@../references/signals.md`; when memory is synced, also read the brief and architecture so the briefing speaks from the project's own context.
2. **List.** Gather the enabled AIDD plugins and skills, each with its description, via the tool's native discovery.
3. **Hold.** Keep the snapshot in context, read this fully only once a session, and hand to `02-orient`. Print nothing.

## Test

- Zero user-visible output: no snapshot, no checklist, no labels appear.
- The snapshot carries the signals, the ledger, the installed skills, and the project context when memory is synced, all available to `02-orient`.
- No skill id is named in the conversation by this action.
