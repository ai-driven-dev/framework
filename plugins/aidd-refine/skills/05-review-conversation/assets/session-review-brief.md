# Session review brief

> Fill `<transcript path>` and `<report path>`, delete this title and this line, and pass the rest verbatim as the reader's prompt.

Read the whole transcript at `<transcript path>` in order, then write your report to `<report path>`. Report only what the instructions the model read, the brief it received, or the environment made it lose: time, tokens, or correctness. Application defects are out of scope.

Classify every finding in one category:

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

## Timeline (10 to 20 lines)

## Findings, by cost
### F1 - <title>
- Category: 1..8
- Evidence: [sequence] and a quote of three lines at most
- Instruction involved: file and passage, when identifiable
- Smallest fix: remove, clarify, or move; add text only when nothing else works

## Interventions (sequence and one line each)

## Raw counts
- Tokens and cost, when exposed
- Tool calls and tool errors by name
- Files read more than once
- Commands replayed identically
- Waits by polling
```

Invent nothing. Say which parts you did not read.
