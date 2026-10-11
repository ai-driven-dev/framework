# 04 - Dashboard

Compute the per-topic picture from the ledger and show where it holds and where it does not.

## Input

The approved tracking plan and its evidence ledger.

## Output

A dashboard per [the template](../assets/dashboard.md), kept in context, with an optional Mermaid chart and an optional CSV of the ledger.

## Process

1. **Count.** Compute comments, verbatims, and distinct voices per topic by filtering the ledger per [counting](../references/counting.md).
2. **Trend.** Split each topic's counts into the plan's time buckets.
3. **Select.** Pick representative verbatims that cover different voices and sources, and add at least one counter-signal when the ledger holds one.
4. **Rate.** Rate each topic and name its gaps per [confidence](../references/confidence.md).
5. **Render.** Fill the template with one topic section per plan topic.
   - Chart asked: add one Mermaid `xychart-beta` bar chart of counts per topic or per bucket.
   - No chart asked: omit the `Chart` section.
   - Spreadsheet asked: export the ledger as CSV, one row per ledger row, same columns.
6. **Show.** Present the dashboard and wait.
   - Too thin or a coverage gap the PM wants closed: return to `plan`.

## Test

| Case | Pass |
| --- | --- |
| Any count recomputed from the ledger | equals the dashboard figure |
| Quote | carries its ledger ID and a source link |
| Topic below the plan's threshold | rated insufficient; no trend claimed |
| Mermaid chart | syntax parses; figures match the summary table |
| CSV | row count equals ledger row count; same columns |
| Reproduce section | names the plan version, the sources read, and the read dates |
