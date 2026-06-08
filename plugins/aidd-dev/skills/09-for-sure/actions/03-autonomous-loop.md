# 03 - Autonomous loop

Orchestrates the loop. For each unchecked step: spawns a worker agent, verifies the result, checks the box or retries. One step = one agent = one log entry. The orchestrator never does the work itself.

## Inputs

```yaml
tracking_file: aidd_docs/tasks/<task-name>.md   # produced by 01-init-tracking
```

## Outputs

```yaml
iterations: <int>
steps_completed: <int>
log_entries: <int>
```

## Process

The loop runs with no human interaction. Inputs and outputs are read from / written to the tracking file.

1. **Read the entire file.** Frontmatter, journey map, steps, full Log.
2. **Increment `iteration`** in frontmatter, and set `status: in-progress` if still `pending`.
3. **Read the Log** to learn from prior attempts.
4. **Find the next unchecked step.**
5. **Spawn a worker agent** for that step with the Worker prompt template (below). Pass the step description and the relevant context (objective, rules, prior Log entries for this step).
6. **Read the worker's result.**
7. **Verify concretely.** Run a check command, read a file, test the output. Do not trust the worker's claim alone.
8. **On verified ✓**: tick the step `[x]` and append a Log entry.
9. **On not verified ✗**: append a Log entry with the failure reason; spawn another worker with the error context.
10. **Move to the next unchecked step.** Loop from step 1.

### After every step is checked

11. **Run the success_condition command** and verify the result yourself.
12. **On TRUE**: set `status: done` in the frontmatter and stop.
13. **On FALSE**: add new steps to address the root cause and continue the loop.

## Worker prompt template

```text
Execute this step. Auto-accept everything - act as the user, make every
decision yourself (approve prompts, generate keys, install tools, click
buttons). Do not ask for permission. Just do it.

Signing in via existing accounts (Google Sign-in, GitHub OAuth, SSO) is NOT
account creation - it uses the user's active browser session. Do it.

STEP: <step description>
CONTEXT: <from tracking file>

Report:
- What you did (specific: commands, files, URLs).
- The concrete result (paste output, screenshot, evidence).
```

## Log entry format

One entry per step attempt:

```text
### #<N> - <timestamp>
> <step name> - <what the worker tried>
= <✓|✗> <verification result - what the orchestrator checked>
-> <next step or RETRY: why>
```

## Test

Each step attempt has exactly one Log entry; every checked step (`[x]`) has a `= ✓` entry whose verification cites a concrete command or file; the loop only sets `status: done` after the `success_condition` command has been re-run and exits zero.
