# 02 - Plan

Draft the script, verify it, plan the writes and get them approved.

## Input

The confirmed frame, or the trial failure verify sent back.

## Process

1. Draft the script per [hook-authoring.md](../references/hook-authoring.md), skipped on remove.
   - Trial failure: fix the script for what the host did.
2. Write the input file per [writer.md](../references/writer.md), skipped on remove.
3. Run the verifier per [writer.md](../references/writer.md) on the input file, skipped on remove.
   - Finding: quote it, fix the script, then go back to step 2.
   - Non-zero exit without findings: quote the output, then stop.
4. Run the writer with `--plan` per [writer.md](../references/writer.md).
   - Non-zero exit: quote the writer's output, then read [frame](01-frame.md) to revise.
5. Present the plan.
   - What the intent does on each host per [hosts.md](../references/hosts.md), and where it falls short.
   - The script in full, and each host's verifier status.
   - Each path with its operation, saying an `update` is written only with `--force`.
   - What the committed config asks of teammates per [hosts.md](../references/hosts.md).
   - A hook that blocks this session's own tool: say it blocks this session once written, its removal included, and give the remove command.
6. End the turn and wait for the user's own answer.
   - Revision: read [frame](01-frame.md).
   - Cancel: stop, cancelled.
7. Read [write](03-write.md) once approved.

## Output

The approved input file and paths, or the cancellation.

## Rules

- Write nothing in the project.
