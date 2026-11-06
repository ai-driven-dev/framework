# Memory rules

The one place that says what a memory file must be.

## Machine rules

| When | Effect |
| --- | --- |
| After a write | every finding informs, nothing blocks |
| `check` | the one strict gate: exits 1 on an error, M1, M3, M4 or a missing always-written file |
| Every other finding, structure included (former, misplaced, team folder) | a warning: the skill checks or proposes, never imposes |

| Id | Severity | Limit | Rule |
| --- | --- | --- | --- |
| M1 | error | 25 words | a sentence over the limit, outside a table, list item, heading, code or diagram: make it a table, a list or a heading |
| M2 | warning | none | a fact that goes stale: a number before a plural noun, a date, a time word. Check it against the code; keep it if true |
| M3 | error | none | a slot copied from the template of the same name and left unfilled, fences included |
| M4 | error | none | a backticked file path that names nothing on disk |
| M5 | warning | 35 words | a bullet or a table cell over the limit |
| M6 | warning | 400 words | a file over the limit |
| M7 | warning | 12 words | a sentence of that length also written in another memory file |

## Reader rules

- These bind every memory file, written or reviewed.
- The scan also uses them to choose what to keep.
- A line the user wrote is exempt only from Non-derivable, Points to the code and Current state only.

| Rule | Keep | Drop |
| --- | --- | --- |
| Non-derivable | the macro and the why: a decision and its constraint, a convention the files repeat without stating, a gotcha that surprises a newcomer, the stack and how the main parts fit, the domain words a contributor must know | a fact one open file re-derives, anything true of every project built this way |
| Points to the code | a path or a command | a copy of a schema, a file tree, a dependency list |
| One fact, one home | - | the copy, the fact keeps its home |
| No version | `React` | `React 19` |
| Current state only | - | an unused section, a placeholder, a plan, a wish, a thing not shipped, a work item, a live value, a technical id, a secret or credential value |
| A diagram stands alone | - | a note or a caption under it |
