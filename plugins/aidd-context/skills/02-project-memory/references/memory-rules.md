# Memory rules

The one place that says what a memory file must be. The engine decides the first table; a reader judges the second.

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

The scan applies these to what it reads; a line the user wrote stays whatever they say.

| Rule | Keep | Drop |
| --- | --- | --- |
| Non-derivable | a decision and its constraint, a convention the files repeat without stating, a gotcha that surprises a newcomer, the stack and how the main parts fit, the domain words a contributor must know | a fact one open file re-derives, anything true of every project built this way |
| Points to the code | a path or a command | a copy of a schema, a file tree, a dependency list |
| One fact, one home | the home | a duplicate |
| No version | `React` | `React 19` |
| Current state only | what ships | an unused section, a placeholder, a plan, a wish, a thing not shipped |
| Stable only | the lasting | a work item, a live value, a technical id |
| A diagram stands alone | the diagram | a note or a caption under it |
