# 01 - Read conversation

Freeze complete evidence and measure visible cost.

## Input

A current conversation, an exact conversation ID, or a complete transcript export.

## Output

An evidence boundary, a `## Timing` table with `Activity | Observed time | Share | Evidence`, a `## Usage` table with `Metric | Value | Evidence`, and a scope index.

## Process

1. **Resolve.** Use the host route in [conversation sources](../assets/conversation-sources.md); stop unless it yields the exact complete transcript.
2. **Freeze.** End before this invocation, or at the export boundary. Exclude every `improve` invocation and report.
3. **Read once.** Load all in-scope messages, tool calls, results, and timestamps. Index relevant turns and named or invoked skill and knowledge paths.
4. **Measure.** Use only timestamps, elapsed records, and exposed host usage.
   - Group tool time as `research and diagnosis`, `implementation`, `validation`, or `unattributed`.
   - Include tokens, requests, and cost only when exposed.
5. **Render.** Order known activity times descending; mark missing metrics `unavailable`. Never call unattributed or unavailable time private reasoning.

## Test

| Case | Pass |
| --- | --- |
| Conversation | exact complete transcript; frozen boundary; no `improve` evidence |
| Metric | cited host record, timestamp, or elapsed record; otherwise `unavailable` |
| Time | visible categories only; no private-reasoning claim |
| Scope | exact turns or artifact paths, never a generated summary |
