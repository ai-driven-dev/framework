# 01 - Read conversation

Read the complete conversation tree and its relevant context.

## Input

Selected conversation ID or export.

## Output

Complete transcripts, one report per session, source index, and observed measurements.

## Process

1. **Read.** Locate and load the selected conversation via [conversation sources](../assets/conversation-sources.md), before this invocation or through its export boundary, then every child session it spawned.
2. **Delegate.** When the tree exceeds one context, give each child session to one reader with [the session review brief](../assets/session-review-brief.md); read the root yourself.
3. **Index.** Retain chronological prompts, tool calls/results, timestamps, and exposed usage, including failures, retries, agents, and linked subcalls; list invoked skills and tools.
4. **Sources.** Read their relevant maintained files, applicable `AGENTS.md`, and referenced memory.
5. **Measure.** Per session: elapsed seconds, tokens, cost, user messages after the first, compactions, tool calls by name, errors by tool, commands replayed identically, files read more than once, waits by polling.

## Rules

- Stop if a transcript is incomplete.
- Exclude previous review runs and reports.
- Reuse valid source reads; never target install copies.
- Distinguish elapsed gaps, tool durations, and process lifetime; never sum overlapping intervals.
