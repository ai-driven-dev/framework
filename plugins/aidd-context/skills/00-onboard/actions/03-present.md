# 03 - Present

Render the screen `02-assess` chose.

## Input

The decision from `02-assess`.

## Output

The rendered screen per `@../assets/report.md`; the reply goes to `04-run`.

## Process

1. **Shape.** Fill the chosen screen from `@../assets/report.md`.
2. **Inject.**
   - Entry screen: the banner from `@../assets/banner.txt`.
   - Flow or walk screen: the curriculum from `@../references/flow.md`.
3. **Warn.** Render each `⚠️` with its cause and a keyed fix; ids and tier clauses stay under `[?]`.
4. **Wait.** Offer the screen, hand the reply to `04-run`.

## Test

- The framing line shows on the first report of the session only.
- Existing repo renders memory as step 1 of 2; greenfield renders the stack first.
- The banner shows on entry screens only.
- Each `⚠️` carries a keyed fix; ids and tier clauses appear only under `[?]`.
