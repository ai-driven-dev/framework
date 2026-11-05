# Session review brief

> Fill `<transcript path>` and `<report path>`, delete this title and this line, and pass the rest verbatim as the reader's prompt.

Read the whole transcript at `<transcript path>` in order, then write your report to `<report path>`. Report only what the instructions the model read, the brief it received, or the environment made it lose: time, tokens, or correctness. Application defects are out of scope.

Use these areas to spot relevant issues, without forcing a numbered category:

1. Instruction misread or ambiguous: quote the passage and the action it produced.
2. Instruction ignored: quote the passage and what was done instead.
3. Loops: files reread, commands replayed, retries of the same error, idle turns.
4. Delegation: brief too long, too short, contradictory, duplicating a file; results unused; a child redoing the parent's reading.
5. Tools and permissions: refusals, timeouts, truncated output, a tool chosen against the one the project names.
6. Context: compactions, large reads, oversized outputs kept.
7. Validation and stopping: done without evidence, never concluding, checks skipped or replayed.
8. Interventions: every message after the first, from the user or the parent, and why it was needed.

Report format:

```markdown
# <session title> (<id>)
Duration, messages, interventions, compactions, delegations, tool errors.

## Timeline (relevant events only)

## Findings, by observed impact
### F1 - <title>
- Evidence: [sequence] and a quote of three lines at most
- Instruction involved: file and passage, when identifiable
- Cause: established, hypothesis, or unknown; distinguish the observed failure from its explanation
- Impact: measured consequence and unit, or unavailable
- Smallest fix: remove, clarify, or move; add text only when nothing else works
- Validation: the observable check that would confirm the remedy; say whether it was run

## Interventions (when relevant, sequence and one line each)

## Raw counts (when recorded)
- Tokens and cost, when exposed
- Tool calls and tool errors by name
- Program exit codes, separately from the tool's reported status
- Files read more than once
- Commands replayed identically
- Waits by polling
```

Invent nothing. Say which parts you did not read.
