# 01 - Scan

Read the project once, silently, into a snapshot. No questions, no writes, no visible output.

## Input

The project root, the current working directory.

## Output

A silent snapshot, never printed: the status (`✓ ⚠ ✗`) of every check in `@../references/state/zones.md`, the detected AI tools each with its wiring glyph, the installed AIDD plugins and skills each with its description, and the project name and purpose from the brief when memory is synced.

## Process

1. **Zones.** Evaluate every check in `@../references/state/zones.md` by its met and drift rules. Scope each to the paths the row names, never an installed-plugin tree. Read VCS state for the current branch only.
2. **Detect.** Resolve the AI-tool roots and per-tool wiring per `@../references/state/detection.md`.
3. **Ledger.** Apply the Done rule in `@../references/state/done-rule.md`: a step the session ledger recorded run or left drops out even when disk cannot prove it. Re-read the ledger every scan.
4. **Hedge.** Only when a plan exists, read its `status:` and pin the build-to-ship stage per `@../references/state/hedge.md`.
5. **Drift.** For memory wiring, compare each used tool's context block against the canonical shape.

   ```md
   @../../02-project-memory/references/memory-block.md
   ```

6. **List.** Gather the enabled AIDD plugins and skills, each with its description, via the tool's native discovery.
7. **Hold.** Keep the snapshot in context and hand to `02-assess`. Print nothing. Refresh disk and VCS facts only on change, not every loop.

## Test

- Zero user-visible output: no snapshot, no checklist, no status appears.
- The snapshot carries a status for every check in `zones.md`, plus detected AI tools with a `✓`/`⚠` wiring glyph and unused tools absent.
- A step the session ledger recorded run or left is absent from the snapshot's actionable set.
- A repo-wide PR on another branch sets no pin; only the current branch's PR does.
