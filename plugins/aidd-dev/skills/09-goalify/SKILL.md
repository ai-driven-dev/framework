---
name: 09-goalify
description: Runs an autonomous goal loop that replans and retries until a runnable success condition passes. Use when the user wants to goalify a task, keep trying until success, or verify a goal by command. Not for one shot tasks or uncheckable goals.
argument-hint: task | command
---

# Goalify

```mermaid
flowchart TD
  Setup[New task] --> Init{init-tracking: existing task status?}
  Resume[Resume task] --> Init
  Init -->|already implemented| Done[Complete]
  Init -->|pending or in-progress| Loop[run-loop under auto-accept]
  Init -->|no file| Collect[Collect inputs and research]
  Collect --> Goal{Unambiguous goal?}
  Goal -->|no| Reformulate[Ask for reformulation]
  Reformulate --> Goal
  Goal -->|yes| Condition{Runnable success command?}
  Condition -->|no| Define[Request a checkable command]
  Define --> Condition
  Condition -->|yes| Preflight[Check prerequisites and collect user-only inputs]
  Preflight --> Ready{Unresolved hard prerequisite?}
  Ready -->|yes| Blocked[Stop for unresolved prerequisite]
  Ready -->|no| Map[Present ASCII journey]
  Map --> Confirm{User confirms journey?}
  Confirm -->|no| Map
  Confirm -->|yes| Directory{Tracking directory exists?}
  Directory -->|no| CreateDirectory[Create tracking directory]
  Directory -->|yes| Create[Fill tracking template and convert journey to Mermaid]
  CreateDirectory --> Create
  Create --> Loop
  Loop --> Remaining{Unchecked steps?}
  Remaining -->|no| Success{success_condition passes?}
  Remaining -->|yes| Select{Ready independent steps and compatible Batch?}
  Select -->|yes| Batch[Delegate parallel execution]
  Select -->|otherwise| Worker[Execute next step]
  Batch --> Autonomy{auto-accept: action safe and in scope?}
  Worker --> Autonomy
  Autonomy -->|outside task| Skip[Skip unrelated action]
  Skip --> Autonomy
  Autonomy -->|payment| Payment[Report payment stop]
  Autonomy -->|destructive| Destructive[Report destructive stop]
  Autonomy -->|yes| Act[Act autonomously]
  Act --> ActionResult{Assigned work outcome?}
  ActionResult -->|self-fixable failure| Fix[Choose an in-scope fix]
  Fix --> Autonomy
  ActionResult -->|more actions| Autonomy
  ActionResult -->|finished or other failure| Verify[Verify each result]
  Payment --> Verify
  Destructive --> Verify
  Verify --> Record[Record each attempt and preserve partial evidence]
  Record --> Safety{Reported safety outcome?}
  Safety -->|payment| StopPayment[Stopped payment]
  Safety -->|destructive| StopDestructive[Stopped destructive action]
  Safety -->|out-of-scope| StopScope[Stopped out-of-scope]
  Safety -->|none| Failed{Failed or missing result?}
  Failed -->|yes| Replan[Analyze failure and amend the plan]
  Replan -->|retry| Loop
  Failed -->|no| Next{Unchecked steps remain?}
  Next -->|yes| Loop
  Next -->|no| Success
  Success -->|no| Replan
  Success -->|yes| Done
```

## Actions

Read [tracking setup](actions/01-init-tracking.md) first.

| Action | Does |
| --- | --- |
| init-tracking | frame the goal, create or resume tracking, launch the loop |
| auto-accept | decide and act within the task's safety limits |
| run-loop | dispatch workers, verify evidence, replan failures, check completion |

## Transversal rules

- Keep all task state in `aidd_docs/tasks/<task-name>.md` and nowhere else.
- Never retry a failed approach without a meaningful change.
- Apply the [autonomy rules](actions/02-auto-accept.md) throughout unattended execution.
- Delegate execution to one leaf worker per step, directly or through a discovered parallel capability.
  - Keep parallel dispatch in the orchestrator's context, without another controller agent.
  - Retain planning, safety decisions, per-item verification, and retries.
  - Never perform the workers' execution yourself.
  - Workers execute only their assigned step and return evidence.
- Select models by responsibility.
  - Use a powerful available model for framing, planning, verification, and replanning.
  - Apply that selection to every orchestrator launch or resume.
  - At every worker launch or relaunch, use the smallest available model with its highest supported reasoning effort.
