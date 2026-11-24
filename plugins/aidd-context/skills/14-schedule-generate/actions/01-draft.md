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
4. Read and fill the [task prompt](../assets/task-prompt.md) in the user's language.
   - Retain every section heading in that language for prompts returned in chat as well as in files.
   - Keep drafting, installation and registration instructions in the surrounding reply.
   - Give each requested skill a numbered step naming its exact installed identifier, its input and its result.
5. Compare the finished execution prompt with the request before returning it.
   - Check each literal skill name, filename and destination character for character in its numbered step or section.
   - Trace one qualifying input through every handoff to the requested destination.
   - If delivery tracking was requested, record success only after confirmed delivery.
   - Trace a valid empty input to the skip outcome and an unavailable prerequisite to the failure outcome separately.
   - Read the prompt in isolation for authoring instructions or unrequested writes that could change the scheduled run.
   - Any mismatch: fix the prompt and repeat step 5.
6. Return the complete prompt, saving it to a file only when requested.
   - For a saved prompt, run `scripts/validate-prompt.cjs` with Node on its path and fix any findings before handing it back.
7. Read [configure](02-configure.md) for each requested scheduler unless the user wants only the prompt.

## Output

A self-contained prompt ready for a fresh agent session.
