# Reading sources

What the scan reads to understand the project. What survives the reading is `memory-rules.md`'s reader rules.

## Read in this order

| Order | Source | Answers |
| --- | --- | --- |
| 1 | the manifest, and a lockfile beside it | the stack, the workspaces, the published name |
| 2 | the root README, then any `docs/` | what it does, for whom, its domain words |
| 3 | the top-level directories | the shape, and which areas own what |
| 4 | the entry points the manifest declares | where execution starts |
| 5 | every file under the VCS platform's own directory | how it ships, and what runs on its own schedule |
| 6 | the test configuration and one test file | the layers, the tools, the conventions |
| 7 | the code, area by area | what the written docs above got wrong |

## Reading rules

- Stop at the first source that answers a question.
- Read the code last: the most expensive and the least quotable, it corrects the others and is never summarised.
- Read every workspace of a monorepo, never the root manifest alone.
- Read a directory whose name repeats across areas once.
- Read nothing under a dependency directory, a build output, or a path the VCS ignores.
