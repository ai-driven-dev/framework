# 01 - Configure the task

## Input

The requested workflow, schedule, time zone and target host.

## Process

1. Resolve the timing, workspace, installed skill names and delivery destination with the user if any essential detail is missing.
2. Fill the [task prompt](../assets/task-prompt.md) in the user's language, preserving literal names and giving each skill a numbered input-to-result step.
3. Map the prompt and timing to the requested scheduler using its guide.
   - Choose [Hermes](../references/hermes.md), [Claude Code](../references/claude.md), [Cursor](../references/cursor.md), [Copilot](../references/copilot.md), [OpenCode](../references/opencode.md), [Kilo](../references/kilo.md), [Codex](../references/codex.md) or [Antigravity](../references/antigravity.md).
   - Prompt only: omit setup.
   - Unsupported or unverified capability: return the portable prompt with the specific limitation.
4. Return the prompt and any setup separately, saving a file only if requested.
5. Register only on explicit request for a supported setup.
   - Inspect existing jobs first and reuse an exact match.
   - On a conflict or uncertain write, report the observed state and stop registration.
6. Read [test](02-test.md).

## Output

The prompt, applicable host settings and any registration identifier.
