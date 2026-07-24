# 04 - Evaluate

Run one communication scenario in fresh context, then let the user judge the raw response.

## Input

One scenario from `@../assets/tests/communication.md`.

## Output

The subagent's unedited response, shown to the user.

## Process

1. **Load.** Load the scenario the user names from `communication.md`. With several and no choice, show their names and wait for the user to pick one.
2. **Spawn.** Spawn one fresh subagent with the exact text under the scenario's `User prompt`. Send nothing else.
3. **Wait.** Wait for the subagent to finish.
4. **Receive.** Retrieve its final response.
5. **Verify.** Verify that the response is complete and unchanged. Do not coach, retry, summarize, correct, score, or defend it.
6. **Judge.** Show the response verbatim to the user for judgment.

## Test

- The subagent receives the selected user prompt verbatim and no task-specific instructions.
- The returned response is byte-for-byte unchanged.
- Only the user judges the response.
