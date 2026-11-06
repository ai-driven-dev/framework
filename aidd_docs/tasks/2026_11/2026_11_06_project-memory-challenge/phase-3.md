---
status: pending
---

# Instruction: A fact comes from the file that defines it

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_11/2026_11_06_project-memory-challenge/
│   └── phase-3.md ✏️
├── plugins/
│   └── aidd-context/
│       └── skills/
│           └── 02-project-memory/
│               └── references/
│                   ├── reading-sources.md ✏️
│                   └── review-protocol.md ✏️
└── scripts/
    └── __tests__/
        └── memory-skill-files.test.js ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | build a repository whose README names one lint command while its pre-commit configuration runs another, and whose commit rules allow three types | the fixture is ready | system |
| Happy path | read the reading order of the skill | it names each category of 3.1 and the defining-file rule, and no tool | system |
| Edge case: conflicting sources | create the memory on the fixture (Haiku, three runs) | `coding-assertions.md` cites the command the pre-commit configuration runs, from an `R` line; `vcs.md` cites no other commit type | cli |
| Teardown | remove the fixture repository | baseline restored | system |

## Tasks to do

### `3.1)` Add the defining files to the reading order

> The baseline's wrong facts were mostly invented specifics: a pre-commit command, a commit type, a test layout. `references/reading-sources.md` names no category of file that defines them.

1. Add, by category and never by tool: what runs checks before a commit.
2. Add the commit message rules and the project's task commands.
3. Add the contribution guide, and the AI instructions and rules the project already holds.

### `3.2)` Replace the stop rule

> The stop rule ("stop at the first source that answers") lets a README end the reading before the file that would contradict it.

1. A command or a convention comes from the file that defines it, and goes to the `R` block.
2. Prose that names one is checked against that file.

### `3.3)` Check cited facts in review

> The review catches a cited fact that its defining file contradicts.

1. `references/review-protocol.md` checks a cited command and a commit type against the same files.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 3.1 | `memory-skill-files.test.js`: the reading order names each category of 3.1 and names no tool; fails on the parent commit |
| 3.2 | `memory-skill-files.test.js`: the reading order names the defining-file rule; fails on the parent commit |
| 3.2 | Eval, Haiku, three runs: on a repository whose README names one lint command while its pre-commit configuration runs another, `coding-assertions.md` cites the command the pre-commit configuration runs, from an `R` line |
| 3.3 | Eval, Haiku, three runs: on a repository whose commit rules allow three types, `vcs.md` cites no other commit type |
