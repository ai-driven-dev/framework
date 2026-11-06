---
status: pending
---

# Instruction: Clean existing issues and close the rolling milestone

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | list open issues without a type and the open items of the rolling milestone | the untyped issues and the 3 pull requests are known | cli |
| Happy path   | set the approved types, detach the pull requests, close the milestone | no untyped open issue, the milestone is closed | cli |
| Edge case    | a pull request still in the milestone | the milestone is not closed until it is detached | cli |

## Tasks to do

### `1)` Type the untyped issues

> Every open issue has a type.

1. List open issues with no type.
2. Propose a type among Bug, Feature, Task, Spike for each, with one line of reason. Do not use Epic.
3. After approval, apply with `gh issue edit <number> --type <name>`.

### `2)` Close the rolling milestone

> `This week` no longer exists as an open container.

1. List its open pull requests and detach them with `gh pr edit <number> --remove-milestone`.
2. Close the milestone with `gh api -X PATCH repos/ai-driven-dev/framework/milestones/<number> -f state=closed`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `gh issue list --state open --json issueType` shows no issue without a type |
| 2 | the milestone state is `closed` and it has no open item |
