# Progress

Flags compare the placement with the source status read today.

| Flag | Month granularity | Horizon granularity |
| --- | --- | --- |
| `done` | the source status is done | the source status is done |
| `on track` | started, and its month has not ended | a `now` item in progress |
| `at risk` | its month is current and the source is not started, or a predecessor is not done | a `now` item not started, or a predecessor not done |
| `slipped` | its month has ended and the source is not done | the quarter has ended and the source is not done |
| `dropped` | the source is cancelled or superseded | the source is cancelled or superseded |
| `unplanned` | a source item in scope that is absent from the roadmap | same |
| `untraced` | a `proposal` item; no status can be read | same |

Read status only from the source. Closed children never make an Epic done.

A ticket status maps to done, started, or not started by the tool's own workflow categories. An unmapped status is reported as read, with no flag.
