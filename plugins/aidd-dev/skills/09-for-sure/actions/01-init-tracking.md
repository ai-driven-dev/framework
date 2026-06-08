# 01 - Init tracking

Pre-flight, validate prerequisites, build a journey map, create the tracking file, and hand off to the autonomous loop. This is the last interactive step before the loop runs unattended.

## Inputs

```yaml
task: <task name or free-form description>      # required
description: <free-form details>                # optional
success_condition: <runnable command>           # required; must exit 0 on success
rules: <bullet list of constraints>             # optional
```

## Outputs

```yaml
tracking_file: aidd_docs/tasks/<task-name>.md
state: resumed | created
preflight_blockers: []                          # non-empty halts before spawn
```

## Process

### Resume flow (existing task)

1. Check `aidd_docs/tasks/` for a file matching the task name, and read its frontmatter `status`:
   - `status: pending` or `in-progress` -> report status (iteration, steps remaining), then skip to step 10 to resume.
   - `status: done` -> report "Task already completed." Stop.
   - No file -> continue to step 2.

### New task flow

2. **Collect from user**: task name, description, success condition, rules.
3. **Research approach.** Before planning steps, read the relevant documentation (README, official guides). Identify the recommended method; do not default to what you already know.
4. **Validate goal.** Ask "could I execute this with zero ambiguity?" If NO -> ask the user to reformulate. Examples:
   - "Make the code better" -> reject. "What metric?"
   - "All tests pass after `npm test`" -> accept.
5. **Validate success condition.** It must be a runnable command. Examples:
   - `npm test exits 0` -> valid.
   - "The code is clean" -> invalid -> push back to `eslint . exits 0`.
6. **Pre-flight checklist.** For each step, list tools, secrets, API access, data, permissions. Markers:
   - `[✓]` already satisfied
   - `[~]` SOFT - the agent will self-serve (sign up, generate key, install tool)
   - `[!]` HARD - only the user can provide it (DB id, channel id, env var, owned API key)
   - Collect every `[!]` now. If any `[!]` remains unresolved, STOP - do not proceed to step 7.
7. **Build the ASCII journey map.** Project the entire path with steps, dependencies, tools, blockers. Ask the user to confirm. Iterate until "does this map look correct? Anything missing?" returns confirmation.
8. **Load the plan template** from `@../assets/plan-template.md`. Create `aidd_docs/tasks/` when missing.
9. **Create `aidd_docs/tasks/<task-name>.md`** using the plan template. Fill frontmatter (`objective`, `success_condition`, `iteration: 0`, `status: pending`), Phases with Tasks and Acceptance criteria (the steps), and include the journey map.
10. **Spawn the autonomous loop.** Read the Orchestrator prompt from `@./03-autonomous-loop.md` and pass it to the Agent tool with `<task-name>` filled in.

## Test

After step 10: the file at `tracking_file` exists with frontmatter `status` (`pending` at creation), its `success_condition` field is a runnable command, the journey map is present, every `[!]` blocker has been resolved before spawn, and an autonomous agent has been launched.
