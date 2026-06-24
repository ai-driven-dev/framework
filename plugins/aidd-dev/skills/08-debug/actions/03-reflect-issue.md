# 03 - Reflect Issue

Reopen the search space: reflect on 5 to 7 fresh sources, distill to the 1 or 2 most likely, and instrument logs to confirm or refute them before any fix.

## Input

The issue carried over from the debug action, and optionally the hypotheses already invalidated.

## Output

The 5 to 7 fresh sources with their rationale, the 1 or 2 most likely with a confidence score, and the validation logs added (file, location, message, what each confirms or refutes).

## Process

1. **Broaden.** List 5 to 7 fresh possible sources, distinct from those already invalidated.
2. **Distill.** Narrow to the 1 or 2 most likely, weighing consistency with the symptom, recent code changes, and available evidence.
3. **Instrument.** Add logs on the relevant code paths that confirm or refute each likely source, each with a clear purpose. Remove the temporary logs once the root cause is found.
4. **Boundary.** Do not implement the fix yet. The goal is to confirm the source first.

## Test

- The fresh sources list has 5 to 7 entries.
- The most-likely list has 1 or 2 entries drawn from them, each with a confidence score.
- The logs added are non-empty, each citing a real file path and a concrete purpose tied to a most-likely source.
