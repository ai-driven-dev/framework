# 01 - Scan

Read the project once, silently, into a reusable snapshot. No questions, no writes, no visible output.

## Input

The project root, the current working directory.

## Output

A silent snapshot, never printed: the status (`✓ ⚠ ✗`) of every check in `@../references/checks.md`, the installed AIDD plugins and skills each with its description, and the project name and purpose from the brief when memory is synced.

## Process

1. **Check.** Evaluate every check in `@../references/checks.md` by its own met and drift rules: a met fact (disk, or a cheap VCS read where the row says so) sets `✓`, a missing artifact sets `✗`, and only the row's stated drift case sets `⚠`. Scope each check to the paths the row names, never an installed-plugin tree.
2. **Ledger.** Apply the Done rule in `@../references/checks.md`: a step the session ledger recorded run or left this session counts done, so it drops out even when disk cannot prove it.
3. **Hedge.** Read the plan's `status:` frontmatter to pin the build-to-ship stage per the zone-3 hedge in `@../references/checks.md`.
4. **Drift.** For the context block, compare the AI context file's `<aidd_project_memory>` block against the canonical shape.

   ```md
   @../../02-project-memory/references/memory-block.md
   ```

5. **List.** Gather the enabled AIDD plugins and skills, each with its description, via the tool's native discovery. This is what `02` resolves each command against.
6. **Hold.** Keep the snapshot in context and hand to `02-report`. Print nothing. Refresh the disk and VCS facts only on change, not every loop. Re-read the session ledger on every scan, so a step recorded since the last scan drops out.

## Test

- Zero user-visible output: no snapshot, no checklist, no status appears.
- The snapshot carries a status for every check in `checks.md` and the installed skills with descriptions.
- A step the session ledger recorded run or left is absent from the snapshot's actionable set.
- Plan `status: in-progress` pins Build alone; `implemented` or an open PR pins Review then Ship.
- No report or command is emitted by this action.
