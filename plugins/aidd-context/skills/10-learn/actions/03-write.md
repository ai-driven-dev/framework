# 03 - Write

Write each approved lesson to the destination the user chose.

## Input

The approved plan from action 02.

## Output

The created or updated files, and a summary table.

## Process

1. **Write.** Send each approved lesson to its home per `@../references/destinations.md`. Write a decision from `@../assets/decision-template.md`, named by a short slug, creating `aidd_docs/memory/internal/decisions/` if absent. Preserve the user's edits, and write files rather than display them.
2. **Report.** A table: lesson, destination, action taken (created, updated, or handed off).

## Test

- Every approved lesson appears in the table. A decision lands as a record in the decisions folder. No rule or skill file was written by learn, and nothing was written into AIDD's own scaffold.
