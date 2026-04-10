# SA-02: Understand the workflow

Gather the complete end-to-end process from the user and the end user's perspective.

## Instructions

1. Ask the user to describe the end-to-end manual process they want to automate.
2. For each step, gather:
   - What tool is used
   - How they verify the step succeeded
   - Conditional behaviors (if X then Y)
   - Documentation they rely on (APIs, conventions, tools, domain knowledge)
3. **Think end-to-end.** Project yourself as the final user of the result. Ask: "The skill produced its output — then what? How does someone discover it, use it, access it?"
4. If the answer reveals missing steps, ask the user. Examples:
   - A landing page is created → where is it linked from? Footer? Nav? Email?
   - A tag is applied → does the tag already exist in the external service?
   - A post is published → is the scheduling configured? Are the accounts connected?
5. Keep gathering until you could execute the workflow yourself AND the result would be complete from the end user's perspective.

## Input / Output

- **Input**: Validated checklist from step 01.
- **Output**: Complete workflow description — every step, tool, verification, conditional, and documentation reference.

## References

- No specific reference needed for this step.

## Test policy

- **Assertion**: The agent can describe every step of the workflow without ambiguity, including what happens after the last step from the end user's perspective.
- **Exit condition**: No open questions remain about the workflow. The agent could execute it manually.
- **Expected result**: Full workflow description with steps, tools, verifications, and edge cases.
- **Retry loop**: If a step is unclear, ask the user for clarification. Loop until all steps are clear. Hard stop after 5 rounds on the same step: flag it as a risk and proceed with documented assumptions.
- **On failure**: List the unclear steps and ask the user to provide more detail or a screen recording of the manual process.
