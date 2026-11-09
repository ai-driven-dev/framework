# Reading sources

What the scan reads to understand the project; what survives the reading is [memory-rules](memory-rules.md)'s reader rules.

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

| Case | Do |
| --- | --- |
| A command or a convention | take it from the file that defines it, as an `R` line; prose that names one is checked against that file |
| The root README | read it whole, and the other docs a section needs |
| The code | read it last: it corrects the others and is never summarised |
| A monorepo | read every workspace, never the root manifest alone |
| A directory whose name repeats across areas | read it once |
| A dependency directory, a build output, or a path the VCS ignores | read nothing under it |

## Filling the sheet

| Slot | Fill |
| --- | --- |
| One the bank answers | skip it |
| Any other | every fact the sources state for it, one line each: each gate, decision, gotcha, rule and release step |
| The brief's `Users`, `Main journey` and `Business rules` | only what the repository states, else a `Q` line, never invented; a setup or an audit collects them, a refresh from a base never adds them |
