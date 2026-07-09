# 03 - Present

Render the screen `02-assess` chose. Fill the shape, keep detail on demand.

## Input

The decision from `02-assess`: the state class, the screen to render, and the ranked action or idle menu.

## Output

The rendered screen per `@../assets/report.md`, offered to the user. The reply goes to `04-run`.

## Process

1. **Shape.** Fill the screen the decision names, from `@../assets/report.md`.
2. **Inject.** On an entry screen, inject the banner from `@../assets/banner.txt`. On a flow or walk screen, load `@../references/flow.md`.
3. **Warn.** Render every `⚠️` with its plain cause and a keyed fix; omit unused tools; command ids and tier clauses stay under `[?]`.
4. **Wait.** Offer the screen and wait for a reply. Never auto-advance. Hand the reply to `04-run`.

## Test

- The framing line shows on the first report of the session only; a later re-scan drops it.
- An existing repo renders memory as foundation step 1 of 2; a greenfield renders the stack first.
- The banner appears on entry screens only; a warning-only screen loads no `flow.md`.
- Every `⚠️` names its cause and offers a keyed fix; no command id or tier clause appears outside `[?]`.
