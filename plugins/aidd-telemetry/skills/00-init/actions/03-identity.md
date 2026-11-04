# 03 - Identity

Let the person choose to be named on their own measurement, or stop being named.

## Input

What the person wants: to be named as an identifier they give, to see the current choice, or to be named no more.

## Process

1. Say that an identity is optional, that it only labels the person axis of their own report, and that it is kept in one file on this machine.
2. Run `aidd telemetry identity` to read the current choice, and tell the person what it holds.
3. To set one, ask the person for the identifier they want and wait for it. Run `aidd telemetry identity <id>` with exactly that text.
   - The command refuses an identifier that is empty, over 128 characters, or spans lines: show its message and stop.
4. To remove it, confirm that the person wants to be named no more, then run `aidd telemetry identity --off`.
5. Run `aidd telemetry identity` again after a change and check that it reports the requested identifier or its removal.

## Output

The identity set, shown or removed, as the command reported it.
