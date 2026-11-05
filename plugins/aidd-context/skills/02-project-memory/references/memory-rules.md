# Memory rules

The one place that says what a memory file must be. The engine decides the first table; the second is judged by a reader.

## Machine rules

| Id | Severity | Limit | Rule |
| --- | --- | --- | --- |
| M1 | error | 25 words | a prose line over the limit: make it a table, a list or a heading |
| M2 | error | none | a fact that goes stale: a number before a plural noun, a date, a time word |
| M3 | error | none | an unfinished marker: `{{`, TODO, TBD |
| M4 | error | none | a backticked file path that names nothing on disk |
| M5 | warning | 35 words | a bullet or a table cell over the limit |
| M6 | warning | 400 words | a file over the limit |
| M7 | warning | 12 words | a sentence of that length also written in another memory file |

## Reader rules

| Rule | Meaning |
| --- | --- |
| Non-derivable | the macro and the why: decisions, conventions, gotchas, never what the code shows |
| Points to the code | a path or a command over a copy of a schema or a file tree |
| One fact, one home | a duplicate keeps its home and loses the copy |
| No version | `React`, not `React 19` |
| Current state only | no unused section, no placeholder |
| A diagram stands alone | no note, no caption under it |
