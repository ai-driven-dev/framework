# Session review brief

> Fill the transcript and report paths, adapt the report fields to recorded evidence, remove this title and instruction, and pass the remaining brief as the reader's prompt. Replace placeholders and omit empty sections in the produced report.

Read the whole transcript at `<transcript path>` in order, then write your report to `<report path>`. Report only what the instructions the model read, the brief it received, or the environment made it lose: time, tokens, or correctness. Application defects are out of scope.

Use these areas to spot relevant issues, without forcing a numbered category:

- **Misread or ambiguous instruction:** quote the passage and the action it produced.
- **Ignored instruction:** quote the passage and what was done instead.
- **Loops:** files reread, commands replayed, retries of the same error, idle turns.
- **Delegation:** oversized, insufficient, contradictory or duplicated briefs; unused results; a child redoing the parent's reading.
- **Tools and permissions:** refusals, timeouts, truncated output, a tool chosen against the project's instruction.
- **Context:** compactions, large reads, oversized outputs kept.
- **Validation and stopping:** completion without evidence, missing checks, repeated checks, failure to conclude.
- **Corrective interventions:** corrections or necessary clarifications from the user or parent, and why they were needed.

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

Use recorded evidence and identify any unread parts.
