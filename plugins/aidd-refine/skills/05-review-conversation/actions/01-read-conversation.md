# 01 - Read conversation

Produce the complete conversation tree, source index and observed measurements.

## Input

Selected conversation ID or export.

## Process

1. Load the root transcript through [conversation sources](../references/conversation-sources.md).
   - End the reviewed interval before this invocation or at the export boundary.
2. List every descendant session through source metadata without reading its transcript.
3. Delegate each child session to its own subagent using the [session review brief](../assets/session-review-brief.md), and read the root yourself.
   - Fill each brief with its transcript and report paths in the run directory.
4. Index the root's prompts, tool calls, results, timestamps, usage, failures, retries and linked subcalls in chronological order.
   - Record invoked skills and tools.
   - Keep tool status and process exit code separate; a completed shell tool can contain a failed command.
5. Read the relevant maintained sources, applicable project instructions and referenced memory.
6. Measure the root and take each child's measurements from its returned report.
   - Record elapsed seconds, tokens, cost, messages after the first, compactions, delegations, tool calls and errors by name.
   - Count identical commands replayed, files reread and polling waits.
   - Preserve source units, scope and accounting fields; distinguish characters, tokens, cached input and uncached input.
   - Treat missing or zero cost counters as insufficient billing evidence.
   - Report aggregate/event mismatches without silently reconciling them.
7. Check transcript content coverage and the returned report for every child against the source index.
   - If evidence is missing, try the complete authorized source under `conversation-sources.md` and repeat the affected read.
   - If required evidence remains unavailable, report the missing content and stop.
8. Continue to [recommend](02-recommend.md).

## Output

Complete transcripts, one report per child session, source index and observed measurements.

## Rules

- **Scope boundary:** exclude previous review runs and reports.
- **Source reuse:** reuse valid reads and inspect maintained sources rather than installed copies.
- **Timing:** distinguish elapsed gaps, tool durations and process lifetime; count overlapping intervals separately rather than summing them.
