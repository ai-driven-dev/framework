# 01 - Read conversation

Freeze complete evidence and measure visible cost.

## Input

A current conversation, an exact conversation ID, or a complete transcript export.

## Output

- Evidence boundary and resource index.
- Chronological timeline with stable event IDs: `Moment | Actor/tool | Action/source | Observed duration | Result`.
- Timing: `Activity | Observed time | Share | Evidence`.
- Usage: `Metric | Value | Evidence`.

## Process

1. **Resolve.** Use the host route in [conversation sources](../assets/conversation-sources.md). Prefer its complete export or host reader. Match the exact session ID before direct storage; search only for that ID, never unrelated sessions, configuration, or authentication. Stop unless the exact complete transcript is available.
2. **Freeze.** End before this invocation, or at the export boundary. Exclude every `improve` invocation and report.
3. **Read once.** Load every in-scope message, tool call, result, and timestamp. Index relevant turns; invoked skills and their used actions or resources; applicable `AGENTS.md`; and task-relevant memory references. Do not read maintained sources yet.
   - Record one timeline row per message, call, or result, including failures and retries. Link call/result pairs; retain full text, arguments, and output.
   - Preserve transcript order. Identify agents, linked calls, and parallel activity when exposed; do not invent hidden calls.
4. **Measure.** Use only timestamps, elapsed records, and exposed host usage.
   - Group tool time as `research and diagnosis`, `implementation`, `validation`, or `unattributed`.
   - Attribute each call duration once; never sum overlapping intervals into elapsed time. Mark unknown durations `unavailable`.
   - Include tokens, requests, and cost only when exposed; otherwise mark them `unavailable`.
   - Separate background-process lifetime from blocking time.
   - Treat private reasoning duration as unavailable unless exposed directly; never infer it.
5. **Deliver.** Cite every measured value. Order only activity totals by descending time; keep the timeline chronological.
