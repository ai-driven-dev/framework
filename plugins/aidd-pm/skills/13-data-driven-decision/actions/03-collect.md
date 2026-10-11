# 03 - Collect

Gather the items the plan points to and classify each one against the topic definitions.

## Input

An approved tracking plan.

## Output

An evidence ledger per [the template](../assets/evidence-ledger.md), with its collection log and exclusions.

## Process

1. **Access.** Resolve each source's route per [sources](../references/sources.md).
2. **Fetch.** Run the plan's query over the window, follow pagination, and log the query, read date, returned count, and completeness.
3. **Classify.** Match each item against the topic definitions per [counting](../references/counting.md) and record topic, kind, voice, date, and link.
4. **Mark.** In a verbatim, mark any cut with `[...]` and any translation as such.
5. **Exclude.** Log every keyword hit that fails a definition, with its reason.
6. **Spot-check.** Show the PM ten ledger rows picked at random and record how many classifications they confirm.
   - When items keep failing to fit a definition, return to `plan` instead of forcing a topic.

## Test

| Case | Pass |
| --- | --- |
| Ledger row | source, link or file locator, date, voice, topic, and kind are all filled |
| Verbatim | the quoted string is found as is in the linked item |
| Same plan and sources rerun | same ledger rows and same counts |
| Source partly read | its collection log row reads incomplete, with the reason |
| Keyword hit without the meaning | listed under exclusions, not counted |
| Spot-check | agreement recorded as confirmed out of checked |
