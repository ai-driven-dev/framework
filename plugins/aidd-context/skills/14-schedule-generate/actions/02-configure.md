# 02 - Configure the scheduler

## Input

The drafted prompt, the chosen host and surface, and whether registration was requested.

## Process

1. Open the reference for the chosen host and surface.
   - Hermes Agent: [Hermes](../references/hermes.md).
   - Claude Code: [Claude](../references/claude.md).
   - Cursor: [Cursor](../references/cursor.md).
   - GitHub Copilot: [Copilot](../references/copilot.md).
   - OpenCode: [OpenCode](../references/opencode.md).
   - Kilo Code: [Kilo](../references/kilo.md).
   - Codex: [Codex](../references/codex.md).
   - Antigravity: [Antigravity](../references/antigravity.md).
   - Unknown host: return the portable prompt and identify native scheduling as unverified.
2. Check the relevant official page against the available tool schema, CLI help or scheduler UI for the selected surface.
   - Use the documentation index to locate the current page if its address has changed.
   - Unsupported or unverifiable timing, lifetime, workspace, skill access or delivery: return the prompt with the specific gap.
3. Present the native setup with the exact trigger, effective zone, prompt, execution context, skills and destination that surface can carry.
   - A surface requires a special return value for a silent skip: include it in the prompt supplied to that scheduler.
   - A CLI accepts prompt text as an argument: pass the whole prompt as one literal argument.
   - The scheduler delivers the result: configure one destination and have the agent return the content once.
   - Unless the user explicitly requests registration, finish with the setup and its verification step.
4. Inspect existing jobs for the same task before an explicitly requested registration.
   - A matching job already exists: skip creation and verify it in step 6.
   - A different job conflicts or the prior write is uncertain: stop and report the existing state.
5. Register only the explicitly requested task through the documented surface.
   - Only the user can access the surface: return the setup for manual registration.
6. Verify the stored trigger, prompt, context, enabled state and next occurrence wherever the scheduler exposes them.
   - A mismatch or write error: report the observed state and identifier before any retry.
7. Report the job identifier or visible entry and the fields verified.

## Output

Native setup with its registration status or the portable prompt with the observed limitation.

## Rules

- Claim a successful execution only from an observed run result.
