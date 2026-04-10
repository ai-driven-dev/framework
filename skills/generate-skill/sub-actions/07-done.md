# SA-07: Done

Give the user the command to use the skill.

## Instructions

1. Confirm that all tests from step 06 passed.
2. Tell the user the skill is ready.
3. Present the command to use it:

   ```
   Skill "<skill-name>" created at <path>.
   To use it, run:
   /clear
   /<skill-name> <describe what you want to do>
   ```

4. Provide a concrete example based on what the skill does. Example: `/<skill-name> Create a landing page for the new product launch`

## Input / Output

- **Input**: All tests passing from step 06.
- **Output**: User has received the command to invoke the skill.

## References

- No specific reference needed for this step.

## Test policy

- **Assertion**: The user has received the `/clear` + `/<skill-name> <args>` command with a concrete example.
- **Exit condition**: The command and example have been presented to the user.
- **Expected result**: User knows how to invoke the skill.
- **Retry loop**: None — this is a presentation step.
- **On failure**: N/A.
