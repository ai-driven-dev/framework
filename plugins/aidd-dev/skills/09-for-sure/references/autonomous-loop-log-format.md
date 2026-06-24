# Autonomous loop: Log entry format

The autonomous loop appends one entry to the tracking file's Log per step attempt, in this exact shape:

```text
### #<N> - <timestamp>
> <step name> - <what the worker tried>
= <✓|✗> <verification result: what the orchestrator checked>
-> <next step or RETRY: why>
```

- `### #<N>` numbers the attempt.
- `>` records the worker's attempt.
- `=` records the orchestrator's own verification (a command run or a file read), not the worker's claim.
- `->` records the decision: the next step, or `RETRY` with the reason.
