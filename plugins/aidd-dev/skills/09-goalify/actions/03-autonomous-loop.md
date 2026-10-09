# 03 - Autonomous loop

Orchestrate the loop: dispatch each unchecked step, verify the result, and replan failures before retrying. One attempt is one worker and one log entry; the orchestrator never does the work itself.

## Input

The tracking file `aidd_docs/tasks/<task-name>.md` produced by `01-init-tracking`. The loop runs with no human interaction, reading and writing through that file.

## Output

The success condition verified and the plan's `status` set to `implemented`, with every step checked and one Log entry per attempt. Or a safety stop with its reason reported.

## Process

1. **Read.** Apply the router's model policy, then read the entire file: frontmatter, journey map, steps, and full Log.
2. **Mark.** Increment `iteration` in the frontmatter, setting `status: in-progress` when still `pending`.
3. **Learn.** Read the Log to learn from prior attempts.
4. **Select.** Find the next unchecked step, or a set of ready independent steps whose prerequisites are already verified. Respect the recorded phases and journey-map dependencies. Frame each item with its existing step identifier (or checkbox position), description, acceptance criteria, dependencies, allowed write scope, and relevant context. Unknown dependencies, overlapping write scopes, or shared mutable resources require sequential execution. If every step is checked, proceed to Evaluate.
5. **Dispatch.** Apply the router's model policy to every worker launch or relaunch, using [autonomous-loop-worker-prompt.md](../assets/autonomous-loop-worker-prompt.md) with the item and context (objective, rules, prior Log entries). For two or more ready independent items, discover a parallel-execution capability by description. Use it only if it accepts pre-framed items, concrete worker model/reasoning settings and safety instructions, spawns leaf executors in the caller's context, and returns per-item evidence without owning tracking or retries. Invoke it in this orchestrator's context, never as another agent. Supply the frames, resolved worker settings, and worker prompt. Immediately before the actual parallel launch, announce: `Batch: executing A, B and C in parallel. Goalify will verify each result.` Substitute the selected item identifiers; do not announce a batch for a rejected or sequential dispatch. If no compatible capability is available, spawn a single worker for the next step instead.
6. **Verify.** Collect results by item identifier. Treat missing or failed results as failures. Verify each returned result concretely by running a check command, reading a file, or testing the output; never trust a worker or Batch claim alone. Dependent steps remain blocked until their prerequisites pass this verification.
7. **Record.** For each attempted item, tick `[x]` only on verified success and append one Log entry per [autonomous-loop-log-format.md](../references/autonomous-loop-log-format.md); leave failed or missing results unchecked. Only the orchestrator writes the tracking file. If any worker stopped for payment, a destructive action, or an out-of-scope request, preserve the batch's partial evidence, stop further dispatch, request running workers to stop where supported, report the reason, and stop; never retry the stopped action.
8. **Replan.** After a failure, analyze that item's worker and verification evidence and amend its tracking step with a changed approach before retrying. Prefix each amendment with 🤖 and a brief rationale. Keep the original objective, success condition, and rules; pass the updated step and failure context to the next worker. Retain verified successes and never relaunch them merely because another batch item failed.
9. **Loop.** Move to the next unchecked step and repeat from Read.
10. **Evaluate.** Once every step is checked, run the `success_condition` command yourself. On exit 0, set `status: implemented` and stop. On failure, analyze the evidence and amend the plan as in Replan, adding unchecked steps for the root cause, then continue the loop.

## Test

| Case | Pass |
| --- | --- |
| Step attempt | Exactly one Log entry records the worker's attempt and the orchestrator's verification. |
| Verified step | The checked step has a `= ✓` entry citing a concrete command, file, or output. |
| Model selection | Orchestrator verification/replanning and every worker launch/relaunch follow the router's model policy. |
| Independent steps | Ready disjoint items are delegated in the orchestrator's context with its resolved worker settings and safety rules; the launch announcement names those items. |
| Unavailable capability or uncertain independence | One worker launches sequentially, without a batch announcement. |
| Dependency | A downstream step cannot launch before each prerequisite is independently verified. |
| Partial batch failure | Successful items stay checked; failed or missing items stay unchecked and are replanned before selective relaunch. |
| Batch tracking | Each attempted item has one Log entry in the existing tracking file; Batch and its executors do not write that file. |
| Failed step | Before another worker launches, the tracking plan contains a changed approach and a 🤖 rationale based on the failure evidence. |
| Safety stop | The reason is reported, the stopped action is not retried, and `status` stays `in-progress`. |
| Final condition fails | `status` stays `in-progress`; the plan gains unchecked steps addressing the failure. |
| Final condition passes | `status: implemented` is set only after the orchestrator re-runs `success_condition` and observes exit 0. |
