# 04 - Evaluate

Run one communication scenario in fresh context, then let the user judge the raw response.

## Input

One scenario from `@../assets/tests/communication.md`.

## Output

The subagent's unedited response, shown to the user.

## Process

1. **Load.** Load the scenario the user names from `communication.md`. With several and no choice, show their names and wait for the user to pick one.
2. **Spawn.** Spawn one fresh subagent with the scenario's user prompt.
3. **Wait.** Wait for the subagent to finish.
4. **Return.** Show its response to the user for judgment.
