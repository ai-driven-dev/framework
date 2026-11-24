# 01 - Configure the task

## Input

The workflow, timing, workspace and intended destination.

## Process

1. Fill the [task prompt](../assets/task-prompt.md) in the user's language with the exact skill names and their numbered handoffs.
   - Missing input, skill or destination: resolve the gap before trial.
2. Prepare the schedule using the selected host's guide.
   - Choose [Hermes](../references/hermes.md), [Claude Code](../references/claude.md), [Cursor](../references/cursor.md), [Copilot](../references/copilot.md), [OpenCode](../references/opencode.md), [Kilo](../references/kilo.md), [Codex](../references/codex.md) or [Antigravity](../references/antigravity.md).
   - Unsupported timing or delivery: give the portable prompt and identify the gap.
3. Define a representative input and observable acceptance criteria for the handoffs, final output and permitted effects.
4. Return the prompt and proposed setup separately, saving a file only if requested.
   - Draft only: stop here.
5. Read [test](02-test.md) before enabling the schedule.

## Output

The proposed configuration and the criteria against which its trial will be judged.
