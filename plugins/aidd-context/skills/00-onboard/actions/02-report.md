# 02 - Report

Lead with one plain state sentence and one recommended action a first-timer can act on, everything else demoted.

## Input

The snapshot from `01-scan` (statuses + installed skills), held in context, not printed.

## Process

1. **Resolve.** For each check, resolve its canonical command in `@../references/checks.md` against the installed skills from `01`. A match keeps the command. No match names a gap by function, never an invented command.
2. **Order.** Rank the recommended list per the `## Ranking` policy in `@../references/checks.md`.
3. **Tag.** Phrase each step's tier as the natural-language clause `@../assets/report.md` maps to the row's tier in `@../references/checks.md`, never a glyph badge.
4. **Render.** Fill `@../assets/report.md`, following its state, dashboard, next, key, and idle-menu rules.
5. **Wait.** Offer the report and wait for a reply. Never auto-advance. Hand the reply to `03-run`.

## Output

The rendered report per `@../assets/report.md`: a framing line on the first report of the session, a `🔍` state sentence, the `🏗️ Foundations` and `🚦 Progress` dashboard rows, and a `👉 Next` recommendation naming the top step in plain words with its `[1]` key plus a compact options line. Command ids and tier clauses live only in the `[?]` detail, never in this default view.

## Test

- The first report of the session opens with the framing line; a re-scan later in the same session drops it.
- The state sentence reads the project's standing in plain words; Progress marks the current stage in `[brackets]`, never `📍/◦/➖`.
- `Next` names the single top-ranked step with key `[1]`; the compact options line uses bracketed keys (`[2]`, `[OK]`, `[?]`); no command id or tier clause appears in the default view.
- When nothing is pending, `Next` is the idle menu (`start new work [1]`, then `improve the project [2] · customize the AI [3] · explore [?]`); umbrella slots re-render a member sub-list on pick, and no `[OK]` is offered.
- Every offered step resolves to a concrete installed command or is a gap named by function.
