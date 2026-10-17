# Identity

Let the person choose to be named on their own measurement, or stop being named.

## Input

What the person wants: to be named as an identifier they give, to see the current choice, or to be named no more.

## Output

The identity set, shown or removed, as the command reported it.

## Process

1. **Explain.** Say that an identity is optional, that it only labels the person axis of their own report, and that it is kept in one file on this machine.
2. **Show.** Run `aidd telemetry identity` to read the current choice, and tell the person what it holds.
3. **Name.** To set one, ask the person for the identifier they want and wait for it. Run `aidd telemetry identity <id>` with exactly that text.
   - The command refuses an identifier that is empty, over 128 characters, or spans lines: show its message and ask again.
4. **Unname.** To remove it, confirm that the person wants to be named no more, then run `aidd telemetry identity --off`.

## Test

| Case | Pass |
| --- | --- |
| The person gives no identifier | Nothing was set and none was invented |
| An identifier is given | `aidd telemetry identity` afterwards prints that identifier |
| Removal is confirmed | `aidd telemetry identity` afterwards says no identity is set |
