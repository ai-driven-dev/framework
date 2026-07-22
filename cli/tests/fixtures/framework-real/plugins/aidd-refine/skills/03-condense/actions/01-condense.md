# 01 - Condense

Toggle terse output mode and apply the requested intensity rules to subsequent prose turns.

## Inputs

- `current_state` (required): inferred from session context. Either `on` (with current intensity level) or `off`.
- `requested_intensity` (required): one of `lite`, `full`, `ultra`, or `toggle` to flip the current state.

## Outputs

```text
Condense: ON (full).
Articles dropped, filler removed. Code, errors, warnings stay verbatim. Toggle off with /condense.
```

## Process

1. Detect the toggle command and target intensity from the user message.
2. Resolve the new state by combining `current_state` with `requested_intensity` (toggle flips, explicit level sets).
3. Emit the confirmation block above with the resolved level filled in.
4. Apply the transversal rules to every subsequent prose turn until the next toggle off, applying per-level rules from `references/intensity-levels.md`.

## Test

- After turning condense ON: the next non-code, non-warning assistant turn drops articles consistent with the active intensity.
- After turning condense OFF: the next assistant turn returns to normal prose.
- Code blocks, quoted errors, and security warnings remain verbatim regardless of condense state.
