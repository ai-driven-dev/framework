# Sources

Use each source only for what it states.

| Source | Where | Yields | Trace |
| --- | --- | --- | --- |
| Epic | `aidd_docs/backlog/epics/*.md`, or the configured backlog | outcome, status, `estimate`, `depends_on`, `order` | the Epic path or id |
| Product Brief | `aidd_docs/product/*.md` with `revision: current` | objective and the opportunity it frames | the brief path |
| Ticket | the configured ticketing tool | title, status, estimate, due date, parent | the ticket id |
| Decision record | a decision log the project keeps in `aidd_docs/` or its memory | a settled choice and its date | the record path |
| Conversation | the user | intent, priority, placement, commitment | `proposal` until a source exists |

Resolve the ticketing tool from project memory first, then repo configuration, then environment. No tool configured: skip tickets and say so.

A superseded or cancelled source yields no candidate.

Several sources describe one outcome: keep one item and list every trace.
