# 03 - Autonomous loop

Orchestrate the loop: dispatch each unchecked step, verify the result, and replan failures before retrying. One attempt is one worker and one log entry; the orchestrator never does the work itself.

## Input

The tracking file `aidd_docs/tasks/<task-name>.md` produced by `01-init-tracking`. The loop runs with no human interaction, reading and writing through that file.

## Output

The success condition verified and the plan's `status` set to `implemented`, with every step checked and one Log entry per attempt. Or a safety stop with its reason reported.

## Process

1. **Read.** Apply the [model policy](../SKILL.md#transversal-rules), then read the entire file: frontmatter, journey map, steps, and full Log.
2. **Mark.** Increment `iteration` in the frontmatter, setting `status: in-progress` when still `pending`.
3. **Learn.** Read the Log to learn from prior attempts.
4. **Next.** Find the next unchecked step.
5. **Spawn.** Apply the router's model policy to every worker launch or relaunch, using [autonomous-loop-worker-prompt.md](../assets/autonomous-loop-worker-prompt.md) with the step description and relevant context (objective, rules, prior Log entries for the step).
6. **Verify.** Read the worker's result, then verify concretely by running a check command, reading a file, or testing the output. Never trust the worker's claim alone.
7. **Record.** On verified success, tick the step `[x]`; on failure, leave it unchecked. Append a Log entry per [autonomous-loop-log-format.md](../references/autonomous-loop-log-format.md). If the worker stopped for payment, a destructive action, or an out-of-scope request, report the reason and stop; never retry the stopped action.
8. **Replan.** After a failure, analyze the worker and verification evidence and amend the tracking plan with a changed approach before retrying. Prefix each amendment with 🤖 and a brief rationale. Keep the original objective, success condition, and rules; pass the updated step and failure context to the next worker.
9. **Loop.** Move to the next unchecked step and repeat from Read.
10. **Evaluate.** Once every step is checked, run the `success_condition` command yourself. On exit 0, set `status: implemented` and stop. On failure, analyze the evidence and amend the plan as in Replan, adding unchecked steps for the root cause, then continue the loop.

## Test

| Case | Pass |
| --- | --- |
| Step attempt | Exactly one Log entry records the worker's attempt and the orchestrator's verification. |
| Verified step | The checked step has a `= ✓` entry citing a concrete command, file, or output. |
| Model selection | Orchestrator verification/replanning and every worker launch/relaunch follow the router's model policy. |
| Failed step | Before another worker launches, the tracking plan contains a changed approach and a 🤖 rationale based on the failure evidence. |
| Safety stop | The reason is reported, the stopped action is not retried, and `status` stays `in-progress`. |
| Final condition fails | `status` stays `in-progress`; the plan gains unchecked steps addressing the failure. |
| Final condition passes | `status: implemented` is set only after the orchestrator re-runs `success_condition` and observes exit 0. |
