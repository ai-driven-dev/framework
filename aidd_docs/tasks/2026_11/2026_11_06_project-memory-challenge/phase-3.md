---
status: pending
---

# Phase 3: The scan reads the files that define a convention

## Problem

The baseline's wrong facts were mostly invented specifics: a pre-commit command, a commit type, a test layout. `references/reading-sources.md` names no category of file that defines them, and its stop rule ("stop at the first source that answers") lets a README end the reading before the file that would contradict it.

## Tasks

| # | Task |
| --- | --- |
| 3.1 | The reading order adds, by category and never by tool: what runs checks before a commit, the commit message rules, the project's task commands, the contribution guide, and the AI instructions the project already holds |
| 3.2 | The stop rule becomes: a command or a convention comes from the file that defines it; prose that names one is checked against that file |
| 3.3 | `references/review-protocol.md` checks a cited command and a commit type against the same files |

## Acceptance

| Test | Pass |
| --- | --- |
| `memory-skill-files.test.js`: the reading order names each category of 3.1 and the defining-file rule, and names no tool | fails on the parent commit |
| Eval, Haiku, three runs: a fixture repo whose README names one lint command while its pre-commit configuration runs another, and whose commit rules allow three types | `coding-assertions.md` cites the command the pre-commit configuration runs; `vcs.md` cites no other commit type |
