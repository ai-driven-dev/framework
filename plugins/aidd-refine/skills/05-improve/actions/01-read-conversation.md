# 01 - Read conversation

1. **Read.** Load the complete selected conversation before this invocation, or through its export boundary. Exclude previous Improve runs and reports. Stop if incomplete.
2. **Index.** Retain chronological prompts, tool calls/results, timestamps, and exposed usage, including failures, retries, agents, and linked subcalls. List invoked skills and tools.
3. **Sources.** Read their relevant maintained files, applicable `AGENTS.md`, and referenced memory. Reuse valid reads; never target install copies.
4. **Measure.** Report elapsed seconds, tokens, call counts, and exposed cost. Pair each user prompt with its recorded response end; leave unpaired durations unavailable. Distinguish elapsed gaps, tool durations, and background-process lifetime; never sum overlapping intervals.
