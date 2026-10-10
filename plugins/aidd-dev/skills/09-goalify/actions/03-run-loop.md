# 03 - Run loop

Dispatch unchecked steps, verify each result, and replan failures before retrying.

## Input

The task file `aidd_docs/tasks/<task-name>.md` created during tracking setup.
The loop runs unattended, reading and writing through that file.

## Output

- Success: final condition verified, every step checked, and `status: implemented`.
- Safety stop: reason reported and `status: in-progress` retained.
- Both paths retain one Log entry per attempted step.

## Process

1. **Read.** Read the entire task file under the router's model policy.
   - Include frontmatter, journey map, steps, and full Log.
2. **Mark.** Increment `iteration` in the frontmatter.
   - Change `pending` to `in-progress` when needed.
3. **Learn.** Review prior attempts in the Log.
4. **Select.** Select the next unchecked step or ready independent steps.
   - Require verified prerequisites and respect recorded phases and journey-map dependencies.
   - Frame each item with its identifier or checkbox position, description, acceptance criteria, dependencies, write scope, and context.
   - Use sequential execution for unknown dependencies, overlapping writes, or shared mutable resources.
   - If every step is checked, proceed to the final success check.
5. **Dispatch.** Dispatch framed work under the router's model policy.
   - Fill the [worker prompt](../assets/autonomous-loop-worker-prompt.md) with the item, objective, rules, and relevant prior Log entries.
   - For two or more ready independent items, discover Batch by description.
     - Require support for pre-framed items, concrete worker model and reasoning settings, and safety instructions.
     - Require caller-context leaf executors and per-item evidence, without Batch owning tracking or retries.
     - Invoke it in this orchestrator's context, never as another agent.
     - Supply frames, resolved settings, and the filled worker prompt.
     - Forbid worker Git mutations during the batch, overriding any per-unit commit policy.
     - Dispatch required Git-mutating steps separately, sequentially.
     - Announce immediately before the actual parallel launch, substituting the selected identifiers:

       ```text
       Batch: executing A, B and C in parallel. Goalify will verify each result.
       ```

   - If fewer than two items are ready, or Batch is unavailable or incompatible, spawn one worker for the next step.
   - Do not announce a batch for rejected or sequential dispatches.
6. **Verify.** Verify each returned result independently.
   - Collect results by item identifier. Treat missing or failed results as failures.
   - Run a check command, read a file, or test the output.
   - Never trust a worker or Batch claim alone.
   - Keep dependent steps blocked until their prerequisites pass verification.
7. **Record.** Record each attempted item's outcome in the tracking file.
   - Only the orchestrator writes this state.
   - Tick `[x]` only on verified success, leaving failed or missing results unchecked.
   - Append each outcome using the [Log format](../references/autonomous-loop-log-format.md).
   - On a payment, destructive, or out-of-scope stop:
     - Preserve partial batch evidence and stop further dispatch.
     - Request running workers to stop where supported.
     - Report the reason and stop. Never retry the stopped action.
8. **Replan.** Replan each failed item before retrying it.
   - Analyze worker and verification evidence.
   - Amend the step with a changed approach, prefixed with 🤖 and a brief rationale.
   - Keep the original objective, success condition, and rules.
   - Pass the updated step and failure context to the next worker.
   - Retain verified successes. Never relaunch them because another batch item failed.
   - If unchecked steps remain, return to reading the tracking file.
9. **Evaluate.** Run `success_condition` yourself once every step is checked.
   - Exit 0: set `status: implemented` and stop.
   - Failure: keep `in-progress` and apply the failure-replanning process to add unchecked root-cause steps.
   - Continue the loop after replanning.

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
| Shared checkout | Parallel workers do not mutate Git state; required Git-mutating steps run sequentially. |
| Failed step | Before another worker launches, the tracking plan contains a changed approach and a 🤖 rationale based on the failure evidence. |
| Safety stop | The reason is reported, the stopped action is not retried, and `status` stays `in-progress`. |
| Final condition fails | `status` stays `in-progress`; the plan gains unchecked steps addressing the failure. |
| Final condition passes | `status: implemented` is set only after the orchestrator re-runs `success_condition` and observes exit 0. |
