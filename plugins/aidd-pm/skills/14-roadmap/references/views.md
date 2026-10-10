# Views

Syntax, naming, and tags follow the Mermaid diagram capability's conventions when it is installed. This file owns only what the roadmap puts in the chart.

| Granularity | Chart | Section | Entry |
| --- | --- | --- | --- |
| month | `gantt` | one per theme | one bar per item, from the first to the last day of its month |
| horizon | `timeline` | one per horizon: `Now`, `Next`, `Later` | one entry per theme, listing its items |

- Title the chart with the quarter label in a `---` frontmatter block.
- A bar spans only months the user placed; the month bounds are the only dates the chart derives.
- A milestone appears only for a date a source or the user states, tagged `milestone`.
- Tag `done`, `active`, or `crit` only from a progress flag or a user request.
- The stakeholder chart holds only the items its table holds.
- Every chart has a matching table below it; the table is the source of truth.
- Keep labels short and on one line; the table carries the detail.
