# Techniques

## Attacks

| Technique | Question | How | Applies to |
| --- | --- | --- | --- |
| Pre-mortem | How does it fail in real use? | Assume it already failed with real inputs and real users, then write down why. | all |
| Hostile inputs | What input breaks it? | Feed boundary, empty, wrong-type, malformed and trap values such as `__proto__`, then watch what it accepts. | code, interface |
| Failure paths | What is left behind when a step fails? | For each step that can fail, trace the state after it: what leaks, stays half done or happens twice. | code, plan |
| Order and state | What breaks when things interleave? | Retry, reorder or overlap operations, and change a value between the moment it is checked and the moment it is used. | code |
| Falsify the claims | Which claim of done or tested is false? | For each claim, build the counterexample that still passes the tests. | all |
| Assumptions check | What does it rest on? | List each assumption the work or the request takes for granted, then test whether it holds. | all |
| Duplication and size | What is there that the aim does not need? | Find what is repeated, unused or larger than the aim requires, then name what can be deleted. | all |
| Alternative | Is there simpler or better? | Build the strongest competing option, then compare what each one costs and gives. | plan, decision |
