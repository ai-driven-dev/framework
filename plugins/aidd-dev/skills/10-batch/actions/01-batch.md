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
3. **Launch.** Spawn one scoped executor per task, all in parallel with fresh contexts. Supply each task's criteria, write ownership, checks, and commit policy. Track each agent's name or ID; require its outcome, changed files, validation evidence, and remaining work.
4. **Collect.** Wait for every dispatched agent to finish or report a blocker. Preserve blocked and failed outcomes; mark an agent that exits with an error as `Failed` even if it returns no summary.
5. **Report.** Print exactly one final table using the output columns, nothing else. Base each status and result on the collected evidence.

## Test

- Every dispatched agent is one row in the table, including blocked or failed agents.
- Each row identifies the agent and its assigned task, status, and result.
- Agents were spawned in a single parallel batch.
- The final table follows collection of all agents' outcomes; `Done` requires completion and validation evidence.
- No output besides the table.
