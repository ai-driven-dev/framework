# 01 - Read conversation

Read the complete conversation tree and its relevant context.

## Input

Selected conversation ID or export.

## Process

1. Load the selected conversation via [conversation sources](../references/conversation-sources.md), before this invocation or through its export boundary, and list every child session it spawned without reading them.
2. Spawn one sub-agent per child session with the [session review brief](../assets/session-review-brief.md), each writing its report in the run directory; read the root yourself.
3. Index the root's chronological prompts, tool calls/results, timestamps, and exposed usage, including failures, retries, agents, and linked subcalls; list invoked skills and tools.
4. Read their relevant maintained files, applicable `AGENTS.md`, and referenced memory.
5. Measure the root: elapsed seconds, tokens, cost, user messages after the first, compactions, tool calls by name, errors by tool, commands replayed identically, files read more than once, waits by polling. Take each child's measurements from its report.

## Output

Complete transcripts, one report per child session, source index, and observed measurements.

## Rules

- Stop if a transcript is incomplete.
- Exclude previous review runs and reports.
- Reuse valid source reads; never target install copies.
- Distinguish elapsed gaps, tool durations, and process lifetime; never sum overlapping intervals.
