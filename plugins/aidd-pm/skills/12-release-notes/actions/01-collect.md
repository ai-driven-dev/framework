# 01 - Collect

Gather what the release shipped into one fact sheet, each row tied to its source.

## Input

A release name or version, a ref range, or a ticket list, pasted or as ids. Optional epic, PRD, or roadmap paths.

## Output

One fact sheet per [fact-sheet.md](../assets/fact-sheet.md), kept in the session, or one open question when nothing resolves.

## Process

1. **Range.** Resolve the release range per [sources.md](../references/sources.md).
   - No range and no ticket list resolve: ask one question for the refs or the tickets, then stop.
2. **Changes.** List the merged pull requests, commits, and changed paths of the range per [sources.md](../references/sources.md).
3. **Tickets.** Resolve the ticketing tool and every ticket id per [sources.md](../references/sources.md), then read each ticket's title, type, status, parent, and acceptance criteria.
   - The tool is unreachable: ask the user to paste the tickets.
4. **Context.** Read the epic, PRD, product brief, or roadmap that each ticket's parent or the user points to.
5. **Reconcile.** Match tickets to changes and set each row's status per [sources.md](../references/sources.md).
6. **Areas.** Group the changed paths of each row into the product capability they serve, read from the ticket and the code's own naming.
7. **Record.** Fill [fact-sheet.md](../assets/fact-sheet.md) and replace every missing cell per [tbd-marker.md](../references/tbd-marker.md).
8. **Route.** Apply [handoffs.md](../references/handoffs.md) to what the sources revealed.

## Test

| Case | Pass |
| --- | --- |
| The action completes | `git status --porcelain` and the ticket records read the same after as before |
| The fact sheet is read back | every row carries a ticket, pull request, or commit in `Source` |
| A listed ticket has no merged change in the range | its row reads `not in this release`, never `shipped` |
| A merged change matches no ticket | it has its own `untracked change` row |
| No range and no ticket list | no fact sheet; one question for the refs or the tickets |
| A cell has no source | it holds a `TBD:` question, not a guess |
