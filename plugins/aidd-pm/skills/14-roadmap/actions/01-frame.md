# 01 - Frame

Fix the quarter, its capacity and constraints, and the audiences before any item is placed.

## Input

The quarter to plan, a product scope, or current context.

## Output

A confirmed frame: quarter label and dates, product scope, granularity, capacity, constraints, and audiences.

## Process

1. **Resolve.** Read the quarter, product scope, and any existing roadmap for that quarter per [persistence](../references/persistence.md).
   - An existing roadmap for the same quarter: offer to update it instead, and hand it to `track` on a yes.
2. **Quarter.** Ask for the quarter and whether it follows the calendar or a fiscal year, when the input does not state it.
3. **Granularity.** Ask whether items land on a month or on a now, next, later horizon, per [placement](../references/placement.md).
4. **Capacity.** Ask for the team capacity, in the unit the team already uses, and the known constraints: fixed dates, holidays, shared people, external commitments.
   - No capacity given: record capacity as unknown.
5. **Audiences.** Ask who receives the stakeholder view, and what it must leave out.
6. **Confirm.** Show the frame in a few lines and fold corrections.

## Test

| Case | Pass |
| --- | --- |
| The run completes | `git status --porcelain` reads the same after as before |
| Quarter not stated | one question asks for it; no quarter is assumed from today's date |
| Capacity not given | the frame records capacity as unknown; no figure appears |
| Roadmap exists for the quarter | the update path is offered before any new draft |
| Frame confirmed | every field holds a user-given value or an explicit unknown |
