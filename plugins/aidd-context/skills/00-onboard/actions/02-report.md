# 02 - Report

Show the loud diagnostic and one ordered command list. Concrete, scannable, no lecture.

## Input

The snapshot from `01-scan` (statuses + installed skills), held in context, not printed.

## Process

1. **Resolve.** For each check, resolve its canonical command in `@../references/checks.md` against the installed skills from `01`. A match keeps the command. No match names a gap by function, never an invented command.
2. **Order.** Rank the recommended list per the `## Ranking` policy in `@../references/checks.md`.
3. **Tag.** Give each recommended line its tier badge from `@../references/checks.md`: `⚡ auto`, `💬 guided`, or `🖐 manual`.
4. **Render.** Fill `@../assets/report.md`, following its glyph vocabularies, collapse, and footer rules.
5. **Wait.** Offer the report and wait for a reply. Never auto-advance. Hand the reply to `03-run`.

## Output

The rendered report per `@../assets/report.md`: emoji section headers, a foundations checklist, an optional context-artifacts row, a dev-flow track, one ordered `Do this next` list of command plus tier badge plus plain purpose, and a one-line footer. No internal names or raw statuses beyond the glyphs.

## Test

- Foundations render above dev flow; every recommended line carries a concrete installed command, a tier badge, and a plain purpose, or is a gap named by function.
- Context artifacts stay info only, collapsed to "none yet" when all absent, never in `Do this next`.
- Nothing uninstalled is named as a command.
- The footer is present, one line, and states what `OK` does in this state.
