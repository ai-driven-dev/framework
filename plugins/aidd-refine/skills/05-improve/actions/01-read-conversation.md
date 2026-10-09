# 01 - Read conversation

Read the complete conversation and its relevant context.

## Input

Selected conversation ID or export.

## Output

Complete transcript, source index, and observed measurements.

## Process

1. **Read.** Locate and load the selected conversation via [conversation sources](../assets/conversation-sources.md), before this invocation or through its export boundary.
2. **Index.** Retain chronological prompts, tool calls/results, timestamps, and exposed usage, including failures, retries, agents, and linked subcalls; list invoked skills and tools.
3. **Sources.** Read their relevant maintained files, applicable `AGENTS.md`, and referenced memory.
4. **Measure.** Record elapsed seconds, tokens, call counts, and exposed cost; pair each user prompt with its recorded response end.

## Rules

- Stop if the transcript is incomplete.
- Exclude previous Improve runs and reports.
- Reuse valid source reads; never target install copies.
- Distinguish elapsed gaps, tool durations, and process lifetime; never sum overlapping intervals.
