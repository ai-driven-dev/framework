# 01 - Batch

Split the user prompt into independent tasks, implement each in parallel, report.

## Input
User's requirement.

## Output
```markdown
| Agent | Task | Status | Result |
| ----- | ---- | ------ | ------ |
```

One row per dispatched agent, identified by its name or ID. Status is `Done` (task completed with validation evidence), `Blocked` (an unmet prerequisite prevents completion), or `Failed` (execution failed). Result summarizes the outcome and changed files, or the reason and remaining work for a blocked or failed task.

## Process

1. **Read.** Take `prompt` from the arguments; if empty, ask the user.
2. **Split.** Divide the prompt into distinct, independent tasks. Inline, no agent.
3. **Launch.** Spawn one `executor` agent per task, all in parallel (one message, multiple Task calls). Track each agent's name or ID and assigned task. Each agent prompt mandates, in order:
   ```markdown
   1. Refine the task first: run a non-interactive refine capability if one is available (discovered at runtime, never a hardcoded plugin name); otherwise restate the task clearly and resolve obvious ambiguity inline. Never block on the user.
   2. Implement the refined task.
   3. Return a one-line summary with status, outcome, changed files, and validation evidence; if blocked or failed, include the reason and remaining work.
   ```
4. **Collect.** Wait for every dispatched agent to finish or report a blocker. Preserve blocked and failed outcomes; mark an agent that exits with an error as `Failed` even if it returns no summary.
5. **Report.** Print exactly one final table using the output columns, nothing else. Base each status and result on the collected evidence.

## Test

- Every dispatched agent is one row in the table, including blocked or failed agents.
- Each row identifies the agent and its assigned task, status, and result.
- Agents were spawned in a single parallel batch.
- Each agent ran a refine step before implementing.
- The final table follows collection of all agents' outcomes; `Done` requires completion and validation evidence.
- No output besides the table.
