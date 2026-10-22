# 01 - Read conversation

Read the complete conversation tree and its relevant context.

## Input

Selected conversation ID or export.

## Output

Complete transcripts, one session report per child session in the run directory, a source index, and observed measurements.

## Process

1. **Locate.** Load the selected conversation and list every child session it spawned via [conversation-sources.md](../references/conversation-sources.md), before this invocation or through its export boundary.
   - Stop if a transcript is incomplete.
   - Exclude previous review runs and reports.
2. **Delegate.** Spawn one sub-agent per child session with the host's agent tool, all in one message, each with [session-review-brief.md](../assets/session-review-brief.md) filled for that session and `sessions/<session-id>.md` as its report path; read the root yourself.
   - Without an agent tool, apply the same brief to each child yourself, one at a time, and record in the source index that no reader was delegated.
3. **Collect.** Check that every listed child session has a non-empty report at its path; spawn a new reader for each one missing.
4. **Index.** Retain chronological prompts, tool calls/results, timestamps, and exposed usage, including failures, retries, agents, and linked subcalls; list invoked skills and tools.
5. **Sources.** Read their relevant maintained files, applicable `AGENTS.md`, and referenced memory.
   - Reuse valid source reads; never target install copies.
6. **Measure.** Per session: elapsed seconds, tokens, cost, user messages after the first, compactions, tool calls by name, errors by tool, commands replayed identically, files read more than once, waits by polling.
   - Distinguish elapsed gaps, tool durations, and process lifetime; never sum overlapping intervals.

## Test

| Case | Pass |
| --- | --- |
| A conversation that spawned three child sessions | `sessions/` holds three reports, one per child session ID |
| A host without an agent tool | the source index states that no reader was delegated |
| A truncated transcript | the run stops before `02-recommend` |
