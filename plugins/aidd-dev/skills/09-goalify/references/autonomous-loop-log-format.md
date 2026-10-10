# Autonomous loop: Log entry format

- Append one entry to the tracking file's Log per step attempt.
- Never rewrite history.
- Use this exact shape:

```text
### #<N> - <timestamp>
> <step name> - <what the worker tried>
= <✓|✗> <verification result: what the orchestrator checked>
-> <next step or RETRY: why>
```

- `### #<N>` numbers the attempt.
- `<timestamp>` records the attempt's UTC time as `YYYY-MM-DDTHH:MM:SSZ`.
- `>` records the worker's attempt.
- `=` records the orchestrator's own verification (a command run or a file read), not the worker's claim.
- `->` records the decision: the next step, or `RETRY` with the reason.
