# 01 - Prepare

Settle what is reviewed, against what, on which axes.

## Input

The arguments: a diff or a base, a plan, a task folder, axes, any recorded evidence.

## Process

1. Resolve the diff: `<base>...HEAD` plus the working tree, tracked and untracked, without the report itself. The base comes from the arguments, else the branch's pull request target, else the repository default branch.
2. Empty: stop and say so.
3. Take the need: the plan, else the ticket, else the request.
4. Take the axes named, else `code` and `relevancy`, plus `functional` when there is a plan.
5. Read [review](02-review.md).

## Output

The diff, the need and the axes.
