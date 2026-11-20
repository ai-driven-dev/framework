# Techniques

## Attacks

| Technique | Question | How |
| --- | --- | --- |
| Pre-mortem | How does it fail in real use? | Assume it already failed with real inputs and real users, then write down why. |
| Assumptions check | What does it rest on? | List each assumption the work or the request takes for granted, then test whether it holds. |
| Alternative | Is there simpler or better? | Build the strongest competing option, then compare what each one costs and gives. |

## Decision

Ask these in order, and the first yes classifies the finding.

| # | Question | Yes |
| --- | --- | --- |
| 1 | Does the work skip or contradict something it was explicitly asked to do? | Deal breaker |
| 2 | Does the work fail its aim in a scenario shown by a command and its output, or by its own lines? | Deal breaker |
| 3 | Does the work do what was asked, while what was asked misses the aim in a scenario you can state? | To decide |
| 4 | Would it make the work serve its aim better? | Suggestion |
| 5 | None of the above. | Dropped |
