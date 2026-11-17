# Memory rules

## Machine rules

| Id | Severity | Limit | Rule |
| --- | --- | --- | --- |
| M1 | error | 25 words | a sentence over the limit outside a table, list item, heading, code or diagram: make it one |
| M2 | warning | none | a date, which goes stale |
| M3 | error | none | a template slot left unfilled, fences included |
| M4 | error | none | a backticked file path that names nothing on disk |
| M5 | warning | 35 words | a bullet or a table cell over the limit |
| M6 | warning | 400 words | a file over the limit |
| M7 | warning | 12 words | a sentence also written in another memory file |

## Reader rules

| Rule | Keep | Drop | A line the user wrote |
| --- | --- | --- | --- |
| Non-derivable | the macro and the why: a decision and its constraint, an unstated convention, a gotcha that surprises a newcomer, the stack and how parts fit, domain words | a fact one open file re-derives, anything true of every such project | exempt |
| Points to the code | a path or a command | a copy of a schema, a file tree, a dependency list | exempt |
| One fact, one home | - | the copy, the fact keeps its home | bound |
| No version | `React` | `React 19` | bound |
| Name, never count or date | the packages by name | `four packages`, a date, `currently` | exempt |
| Current state only | - | an unused section, a placeholder, a plan, a wish, a thing not shipped, a work item, a live value, a technical id, a secret or credential value | exempt |
| A diagram stands alone | - | a note or a caption under it | bound |
