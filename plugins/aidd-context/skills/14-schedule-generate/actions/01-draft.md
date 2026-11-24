# 01 - Draft the task

## Input

The requested outcome, timing, working context and any skills the user wants to reuse.

## Process

1. Capture the trigger, including the time zone for a wall-clock schedule and whether it must survive the current session.
2. Identify the inputs and destination available to a fresh run in the target workspace or profile.
   - An essential detail is ambiguous: ask for that detail and resume here.
3. Resolve requested skill names against the target inventory or the skill files the user supplies.
   - A skill is missing or its instructions require human input: flag the dependency and specify where the unattended run must stop.
   - The workflow needs no skill: describe the operations directly.
4. Fill the [task prompt](../assets/task-prompt.md) in the user's language.
5. Trace one qualifying input through the numbered steps to the destination.
   - A link in the chain is missing: repair the draft and repeat step 5.
   - Trace a valid empty input to the skip outcome and an unavailable prerequisite to the failure outcome separately.
   - Either case reaches success or the wrong outcome: correct its stop condition and repeat step 5.
6. Return the complete prompt, saving it to a file only when requested.
   - For a saved prompt, run `scripts/validate-prompt.cjs` with Node on its path and fix any findings before handing it back.
7. Read [configure](02-configure.md) for each requested scheduler unless the user wants only the prompt.

## Output

A self-contained prompt ready for a fresh agent session.
