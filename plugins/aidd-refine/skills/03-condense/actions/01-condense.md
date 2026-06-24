# 01 - Condense

Toggle terse output mode and apply the requested intensity rules to subsequent prose turns.

## Input

- Whether condense is currently on (and at which level) or off, read from session context.
- The requested change: a level (lite, full, ultra) or a plain on/off toggle.

## Output

A single confirmation line stating the resolved state: `Condense: ON (<level>).` with a one-line note that articles drop while code, errors, and warnings stay verbatim, or `Condense: OFF.` when disabling.

## Process

1. **Detect.** Read the toggle command and target level from the user message.
2. **Resolve.** Combine the current state with the request:
   - Explicit level (`lite | full | ultra`) sets that level (or switches level if already on).
   - `toggle` flips on/off; default level when turning on is `full`.
   - Off phrases (`stop condense`, `normal mode`, `/condense off`) force off.
3. **Emit.** Print the confirmation line with the resolved state filled in.
4. **Apply.** Apply the transversal rules to every subsequent prose turn until the next off signal, using per-level rules from `@../references/intensity-levels.md`.
5. **Hold.** Do not drift back to verbose prose across many turns, when uncertain, or when the topic changes. Auto-pause only for the specific passages listed in the reference.

## Test

- After turning condense ON: the next non-code, non-warning assistant turn drops articles consistent with the active intensity.
- After turning condense OFF: the next assistant turn returns to normal prose.
- Code blocks, quoted errors, and security warnings remain verbatim regardless of condense state.
- After 5 consecutive turns post-activation: the terse style is still applied (no drift back to verbose).
