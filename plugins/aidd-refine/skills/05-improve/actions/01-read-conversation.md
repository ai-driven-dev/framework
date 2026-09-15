# 01 - Read conversation

Load complete conversation evidence once and profile its visible cost.

## Input

A current conversation, an exact conversation ID, or a complete transcript export.

## Output

An evidence boundary, a `## Timing` table with `Activity | Observed time | Share | Evidence`, a `## Usage` table with `Metric | Value | Evidence`, and a scope index.

## Process

1. **Resolve.** Choose the host-specific transcript source from [conversation sources](../assets/conversation-sources.md).
   - Stop when no complete transcript can be resolved for the exact conversation.
2. **Bound.** Freeze the evidence at the message before the current invocation, or at the supplied export boundary.
3. **Read.** Load every in-scope message, tool call, tool result, and timestamp from that transcript.
4. **Index.** Record relevant turns and invoked or named skills and knowledge files for downstream analysis.
5. **Measure.** Calculate visible time and usage only from timestamps, elapsed records, or host usage data.
   - Group explicit tool activity as `research and diagnosis`, `implementation`, or `validation`; keep mixed or unknown time `unattributed`.
   - Include tokens, requests, and monetary cost only when the source exposes them.
   - Never label unattributed wait as reasoning time.
6. **Render.** Mark a missing metric `unavailable` and order known activity times from longest to shortest.

## Test

| Case | Pass |
| --- | --- |
| A conversation is analyzed | its source resolves to one exact complete transcript |
| The same conversation is analyzed again | its evidence excludes every `improve` invocation and report |
| A timing metric is shown | its evidence identifies visible timestamp or elapsed records |
| A metric is unavailable | the report does not estimate or call it reasoning time |
| A usage metric is shown | its evidence identifies the host record that exposes it |
| A scope is indexed | it identifies exact turns or artifact paths, not a generated summary |
