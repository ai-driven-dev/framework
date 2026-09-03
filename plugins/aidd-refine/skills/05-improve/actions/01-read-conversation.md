# 01 - Read conversation

Load complete conversation evidence and profile its visible cost.

## Input

A current conversation, an exact conversation ID, or a complete transcript export.

## Output

A `## Timing` table with `Turn | Wall time | Tool time | Unattributed wait | Evidence`.

## Process

1. **Resolve.** Choose the host-specific transcript source from [conversation sources](../assets/conversation-sources.md).
   - Stop when no complete transcript can be resolved for the exact conversation.
2. **Bound.** Freeze the evidence at the message before the current invocation, or at the supplied export boundary.
3. **Read.** Load every in-scope message, tool call, tool result, and timestamp from that transcript.
4. **Measure.** Calculate turn wall time and tool time from visible timestamps or elapsed records.
   - Calculate `Unattributed wait` as wall time minus tool time when both values exist.
   - Never label unattributed wait as reasoning time.
5. **Render.** Mark a missing metric `unavailable` and order known wall times from longest to shortest.

## Test

| Case | Pass |
| --- | --- |
| A conversation is analyzed | its source resolves to one exact complete transcript |
| The same conversation is analyzed again | its evidence excludes every `improve` invocation and report |
| A timing metric is shown | its evidence identifies visible timestamp or elapsed records |
| A metric is unavailable | the report does not estimate or call it reasoning time |
