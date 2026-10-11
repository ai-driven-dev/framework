# 02 - Plan

Turn the frame into a tracking plan the PM approves before anything is counted.

## Input

The confirmed decision frame, or an existing tracking plan to revise.

## Output

An approved tracking plan per [the template](../assets/tracking-plan.md), persisted per [persistence](../references/persistence.md).

## Process

1. **Define.** Fill one topic row per theme: a definition, what counts, what does not, and search keywords.
2. **Source.** Fill one source row per reachable source with its access route and the exact query, filter, or file.
3. **Rule.** Set the units, deduplication, time buckets, and thresholds per [counting](../references/counting.md) and [confidence](../references/confidence.md).
4. **Calibrate.** Read up to ten items from one source without recording them, show which match each definition and which do not, and sharpen the definitions with the PM.
5. **Show.** Present the full plan and wait for approval or revision.
   - A revision that changes the decision, options, or population returns to `interview`.
6. **Persist.** When the PM authorizes a write, save the approved plan with `status: approved` and read it back.

## Test

| Case | Pass |
| --- | --- |
| Topic row | definition, counts, does not count, and keywords are all filled |
| Source row | a query, filter, or file name that a second person could rerun |
| Plan not approved | no collection run; workspace unchanged |
| Plan approved and write authorized | the written plan carries `status: approved` and a `version` |
| Approved plan changed | `version` incremented; any earlier dashboard is marked stale |
