# 01 - Scan

Read the project once, silently, into a reusable snapshot. No questions, no writes, no visible output.

## Input

The project root, the current working directory.

## Output

A silent snapshot, never printed: the status (`✓ ⚠ ✗` or not-applicable) of every check in `@../references/checks.md`, the installed AIDD plugins and skills each with its description, and the project name and purpose from the brief when memory is synced.

## Process

1. **Check.** Evaluate every check in `@../references/checks.md` by its own met and drift rules: a met fact (disk, or a cheap VCS read where the row says so) sets `✓`, a missing artifact sets `✗`, and only the row's stated drift case sets `⚠`. Scope each check to the paths the row names, never an installed-plugin tree.
2. **Drift.** For the context block, compare the AI context file's `<aidd_project_memory>` block against the canonical shape.

   ```md
   @../../02-project-memory/references/memory-block.md
   ```

3. **List.** Gather the enabled AIDD plugins and skills, each with its description, via the tool's native discovery. This is what `02` resolves each command against.
4. **Hold.** Keep the snapshot in context, read this fully only once a session, and hand to `02-report`. Print nothing.

## Test

- Zero user-visible output: no snapshot, no checklist, no status appears.
- The snapshot carries a status for every check in `checks.md` and the installed skills with descriptions.
- No report or command is emitted by this action.
