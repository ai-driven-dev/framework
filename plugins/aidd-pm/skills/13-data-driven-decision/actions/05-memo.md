# 05 - Memo

Weigh each option against the evidence and hand the decision back to the PM.

## Input

The decision frame, the dashboard, and the ledger.

## Output

A decision memo per [the template](../assets/decision-memo.md), persisted with the dashboard and ledger per [persistence](../references/persistence.md). After a write, report the written paths, the plan version, and the read-back result. Without a write, state that no persisted change occurred.

## Process

1. **Map.** For each option, list the evidence for and against it, citing topic, count, and ledger IDs.
2. **Test.** Compare the evidence with the change-of-mind criteria set during the interview and state whether each was met.
3. **Bound.** Write what the data does not say: gaps, silent populations, source bias, and questions left open.
4. **Lean.** State which option the evidence favors and at what confidence, or state that the data is too thin to favor any.
5. **Hand back.** Present the memo, ask the PM for their decision and rationale, and record them in their words.
   - The PM wants more evidence: return to `collect` with the named source or window.
6. **Persist.** Write the memo, dashboard, and ledger when authorized, then read them back.
7. **Continue.** Apply [handoffs](../references/handoffs.md) to the next move.

## Test

| Case | Pass |
| --- | --- |
| Option row | holds evidence for and against, or reads `none found` |
| Evidence claim | traces to a dashboard topic and ledger IDs |
| Decision field | holds the PM's words or `pending`, never a choice made by the run |
| Data too thin | the memo says so before any lean |
| Unauthorized | workspace unchanged; the response states no persisted change |
| Authorized write | memo, dashboard, and ledger exist at the persistence path and read back |
