# 01 - Read conversation

Read the complete conversation tree and its relevant context.

## Input

Selected conversation ID or export.

## Output

Complete transcripts, one report per child session, source index, and observed measurements.

## Process

1. **Read.** Load the selected conversation via [conversation-sources.md](../references/conversation-sources.md), before this invocation or through its export boundary, then every child session it spawned.
   - Stop if a transcript is incomplete; exclude previous review runs and reports.
2. **Delegate.** Spawn one sub-agent per child session with [session-review-brief.md](../assets/session-review-brief.md); read the root yourself.
3. **Index.** Retain chronological prompts, tool calls/results, timestamps, and exposed usage, including failures, retries, agents, and linked subcalls; list invoked skills and tools.
4. **Sources.** Read their relevant maintained files, applicable `AGENTS.md`, and referenced memory; reuse valid reads, never install copies.
5. **Measure.** Per session: elapsed seconds, tokens, cost, user messages after the first, compactions, tool calls by name, errors by tool, commands replayed identically, files read more than once, waits by polling.
   - Distinguish elapsed gaps, tool durations, and process lifetime; never sum overlapping intervals.

## Test

| Case | Pass |
| --- | --- |
| A conversation that spawned three child sessions | three session reports, one per child |
