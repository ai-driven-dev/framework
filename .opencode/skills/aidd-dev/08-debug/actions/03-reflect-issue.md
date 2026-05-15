# 03 - Reflect Issue

Re-open the search space by reflecting on 5-7 fresh possible sources, distilling them down to the 1-2 most likely, and instrumenting the code with logs that will confirm or refute the picks before any fix.

## Inputs

```yaml
issue: <free-form description of the symptom or error, carried over from the debug action>
prior_hypotheses: <list of hypotheses already invalidated, optional>
```

## Outputs

```yaml
new_sources:
  - { id: <int>, description: <text>, rationale: <text> }
most_likely:
  - { id: <int>, description: <text>, confidence: 1-10 }
logs_added:
  - { file: <path>, location: <function or line>, log_message: <text>, purpose: <what it confirms or refutes> }
```

## Process

1. **List 5-7 fresh possible sources** of the problem, distinct from those already invalidated.
2. **Distill to 1-2 most likely** sources based on consistency with the symptom, recent code changes, and confidence in available evidence.
3. **Add validation logs.** Instrument the relevant code paths with logs that will confirm or refute each of the most-likely sources. Each log has a clear purpose; remove temporary logs after the root cause is found.
4. **Boundary.** Do not implement the fix yet. The goal is to confirm the source first.

## Test

`new_sources` contains 5-7 entries; `most_likely` contains 1-2 entries selected from `new_sources` with a confidence score; `logs_added` is non-empty and every entry cites a real file path and a concrete `purpose` tied to one of the most-likely sources.
