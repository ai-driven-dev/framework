# 03 - Present

Render the screen the decision names.

## Input

The current decision.

## Output

The rendered screen, and the user's reply.

## Process

1. **Shape.** Fill the chosen screen from `@../assets/report.md`.
   - Framing line on the first report of the session only.
   - Glyphs: ✅ met · ⚠️ present, not wired · ❌ missing. Each `⚠️` shows its cause and a keyed fix.
   - Command ids and tier clauses only under `[?]`.
2. **Inject.** Entry screen takes `@../assets/banner.txt`. Flow or walk screen loads `@../references/flow.md`.
3. **Wait.** Offer the screen, take the reply.

## Test

- The framing line shows on the first report of the session only.
- An existing repo renders memory as step 1 of 2.
- A greenfield repo renders the stack first.
- The banner shows on entry screens only.
- Each `⚠️` carries a keyed fix, its id and tier clause only under `[?]`.
