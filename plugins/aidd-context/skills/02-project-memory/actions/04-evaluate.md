# 04 - Evaluate

Test the communication contract without conversation history, then let the user judge the raw response.

## Input

- The full `@../assets/AGENTS.md` template.
- One scenario from `@../assets/tests/communication.md`.

## Output

The subagent's unedited response and the user's verdict.

## Process

1. **Select.** Use the scenario the user names. With one available scenario, name and use it. With several and no choice, show their names and wait for the user to pick one.
2. **Isolate.** Have the caller spawn one fresh subagent with no inherited conversation. If fresh context is unavailable, stop; a self-test or role-play is not a valid fallback.
3. **Compose.** Give the subagent only the full `AGENTS.md` content as its task-specific instructions and the exact text under the scenario's `User prompt`. Do not send the review checks, an expected response, prior feedback, or repository findings.
4. **Run.** Let the subagent answer once. Do not coach it, retry it, or ask a follow-up.
5. **Return.** Show its response verbatim, followed by the scenario's human review checks. Do not summarize, correct, score, or defend the response.
6. **Judge.** Wait for the user's verdict. Record no pass until the user explicitly accepts the response.

## Test

- The subagent receives no inherited conversation.
- Its task-specific context contains only `AGENTS.md` and the selected user prompt.
- The returned response is byte-for-byte unchanged.
- The result remains ungraded until the user gives a verdict.
