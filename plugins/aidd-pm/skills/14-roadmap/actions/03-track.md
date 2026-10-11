# 03 - Track

Compare a persisted roadmap with the actual progress of its items and flag every drift.

## Input

A persisted roadmap, and today's date.

## Output

A progress report: one row per item with its planned placement, its current source status, and its flag, then the new candidates found.

## Process

1. **Load.** Read the roadmap per [persistence](../references/persistence.md).
2. **Refresh.** Read the current status of each traced item from its source, per [sources](../references/sources.md).
3. **Flag.** Apply [progress](../references/progress.md) to every item, against today's date.
4. **Spot.** List source items created or moved into scope since the roadmap was approved, and not on it.
5. **Report.** Show the flagged items first, each with its evidence, then ask whether to replan, add candidates, or keep the roadmap.
   - Replan: hand the report to `arrange`.
   - New candidates: hand them to `collect`.
   - Keep: end with the report; no write.

## Test

| Case | Pass |
| --- | --- |
| The run completes | `git status --porcelain` reads the same after as before |
| An item past its month and not done | it is flagged `slipped`, with its source status quoted |
| A source cancelled | the item is flagged `dropped`; it is not removed |
| A flag | it cites the source status and the date it was read |
| An Epic whose children are closed | it is not reported done without its source status saying so |
| No drift | the report states that every item is on track |
