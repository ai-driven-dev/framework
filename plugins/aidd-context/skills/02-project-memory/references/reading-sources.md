# Reading sources

What the scan reads to understand the project.

- What survives the reading is `memory-rules.md`'s reader rules.

## Read in this order

| Order | Source | Answers |
| --- | --- | --- |
| 1 | the manifests, the workspace file and a lockfile | the stack, the packages and their count, the published name |
| 2 | the root README, then any `docs/` | what it does, for whom, its domain words |
| 3 | the top-level directories | the shape, who owns what |
| 4 | the entry points the manifests declare | where execution starts |
| 5 | every file under the VCS platform's own directory | how it ships, what runs on a schedule |
| 6 | what runs before a commit or a push, and the task commands | the gate commands |
| 7 | the commit message rules, the contribution guide, and the AI instructions and rules the project holds outside the memory and its synced block | the allowed commit types, which conventions a rule already covers |
| 8 | the test configuration, one test file | the layers, the tools, the conventions |
| 9 | the code, area by area | what the docs above got wrong |

## Reading rules

- A command or a convention comes from the file that defines it, as an `R` line; prose that names one is checked against that file.
- Read the README and each doc whole, never a leading excerpt, a byte range or a jump between headings.
- Read the code last: it corrects the others and is never summarised.
- Read every workspace of a monorepo, never the root manifest alone.
- Read a directory whose name repeats across areas once.
- Read nothing under a dependency directory, a build output, or a path the VCS ignores.
