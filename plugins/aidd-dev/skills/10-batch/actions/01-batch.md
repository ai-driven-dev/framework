# 01 - Batch

Dispatch ready independent items to leaf executors and return one evidence row per item.

## Input

A standalone requirement, or delegated items with stable identifiers, step descriptions, acceptance criteria, dependencies, allowed write scopes, relevant context, worker instructions, and caller-selected execution settings (model and reasoning effort when supplied).

## Output

One result per item, returned to the caller. `returned` means the executor supplied a result, not that an independent check passed. Include commands, outputs, changed files or other concrete evidence, and any failure or safety-stop reason. Missing results are failures.

```markdown
| Item | Status | Evidence |
| ---- | ------ | -------- |
```

## Process

1. **Frame.** For delegated items, retain the supplied frames unchanged. For a standalone request, split and refine items inline in the caller's context, using a discovered non-interactive refinement capability when available; otherwise clarify obvious ambiguity inline. Assign identifiers, acceptance criteria, dependencies, and allowed write scopes. Ask for the requirement only when standalone input is empty; return incomplete delegated frames to their owner.
2. **Check readiness.** Require satisfied dependencies and disjoint write scopes and mutable resources. Do not launch dependent, conflicting, or insufficiently scoped items together; return the reason to the caller without guessing or widening scope. Require the host to support the supplied worker settings and inherited safety rules.
3. **Launch.** In the caller's context, spawn one leaf `executor` per item concurrently within the host's capacity. Apply the supplied model and reasoning effort exactly, or inherit the caller's settings when none were supplied. Pass each item's frame, worker instructions, and safety rules unchanged. Mandate execution only within that item and its write scope, concrete evidence on return, and no agent spawning. Explicitly override the executor's per-unit commit policy for this dispatch: no Git mutations (staging, commits, branch changes, or pushes); the owner serializes any authorized Git writes after the batch. Never spawn a Batch controller or modify the owner's tracking file.
4. **Collect.** Wait for every launched item and associate its result with its identifier. Preserve partial results. On a safety stop, stop further dispatch and request any running executors to stop where supported; report the gate without retrying it. Do not retry, replan, certify completion, or launch dependent follow-up work.
5. **Report.** Return one minimal table with `returned`, `failed`, or `stopped` and concrete evidence per item. When invoked by a goal owner, return it to that owner for verification; do not override its progress announcement or final report. Standalone output is the table only.

## Test

| Case | Pass |
| --- | --- |
| Standalone request | Items are refined in the caller's context before executor launches; the user receives one result table. |
| Delegated frames | Identifiers, criteria, scopes, worker settings, and safety rules are preserved without a second refinement. |
| Independent items | One leaf executor per item runs concurrently; no extra agent tier or nested spawning is added. |
| Shared checkout | Leaf executors perform no Git mutations; the owner handles authorized Git writes after all workers finish. |
| Dependency or shared writes | Unsafe items are not launched together; their owner receives the reason. |
| Unsupported worker settings | No silently substituted model or reasoning effort is used. |
| Partial failure or missing result | Each item has its own evidence or failure row; no retry or success certification occurs. |
| Safety stop | Further dispatch stops, partial evidence is returned, and the gate is not retried. |
