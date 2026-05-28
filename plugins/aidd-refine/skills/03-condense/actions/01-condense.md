# 01 - Condense

Toggle terse output mode and apply the requested intensity rules to subsequent prose turns.

## Inputs

- `current_state` (required): inferred from session context. Either `on` (with current intensity level) or `off`.
- `requested_intensity` (required): one of `lite`, `full`, `ultra`, or `toggle` to flip the current state.

## Outputs

```text
Condense: ON (full).
Articles dropped, filler removed. Code, errors, warnings stay verbatim. Stop with "stop condense" or "normal mode".
```

Or on off:

```text
Condense: OFF.
Normal prose resumed.
```

## Process

1. Detect the toggle command and target intensity from the user message.
2. Resolve the new state by combining `current_state` with `requested_intensity`:
   - Explicit level (`lite | full | ultra`) sets that level (or switches level if already on).
   - `toggle` flips on/off; default level when turning on is `full`.
   - Off phrases (`stop condense`, `normal mode`, `/condense off`) force off.
3. Emit the confirmation block with the resolved state filled in.
4. Apply the transversal rules to every subsequent prose turn until the next off signal, using per-level rules from `@../../references/intensity-levels.md`.
5. **Hold persistence.** Do not drift back to verbose prose across many turns, when uncertain, or when the topic changes. Auto-pause only for the specific passages listed in the reference.

## Test

- After turning condense ON: the next non-code, non-warning assistant turn drops articles consistent with the active intensity.
- After turning condense OFF: the next assistant turn returns to normal prose.
- Code blocks, quoted errors, and security warnings remain verbatim regardless of condense state.
- After 5 consecutive turns post-activation: the terse style is still applied (no drift back to verbose).
