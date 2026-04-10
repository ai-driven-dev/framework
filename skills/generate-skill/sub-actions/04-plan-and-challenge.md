# SA-04: Plan & challenge

Present the full workflow visually and challenge every step with the user before writing any file.

## Instructions

1. **Do not write any skill file before this step is complete.**
2. Present the full workflow as an ASCII diagram. Each block must show:
   - The sub-action name
   - Its goal (what it does)
   - Its validation condition (when it's done)
   - References consumed (if any)
   Use arrows for flow, parallel branches for same-numbered actions.

   Example block format:
   ```
   ┌────────────────────────────────────────┐
   │ 01 - Action name                       │ ← references/doc.md
   │ Goal: What this action accomplishes    │
   │ Valid: When this is true, it's done    │
   └─────────┬──────────────────────────────┘
   ```

3. **Challenge every step.** For each sub-action, ask:
   - "What if this fails? What's the fallback?"
   - "Does this depend on something that might not exist yet?"
   - "After this step, is the result usable or does it need something else?"
   - "Is there a step missing between this one and the next?"
4. **Challenge the overall flow:**
   - "Where does the workflow start? Is the starting point always available?"
   - "Where does it end? Is the end state complete from the user's perspective?"
   - "Are there edge cases or conditional branches not represented?"
5. **Present a validation table** with one row per sub-action:

   ```
   | # | Sub-action | Goal | Precondition | Validation | Status |
   |---|---|---|---|---|---|
   | 01 | <name> | <what it does> | <what must be true BEFORE> | <what must be true AFTER> | |
   ```

6. Challenge the user on each row:
   - **Precondition**: "For this action to succeed, X must already exist/be configured. Is that the case right now?" (e.g., a tag must exist in the external service, an API endpoint must accept this payload, a database must have this schema)
   - **Validation**: "After this action runs, how do we verify it worked? Is this check realistic?"
7. Add ✅ as items are validated, ❌ if a precondition fails.
8. If any precondition is ❌, either add a prior sub-action to create the missing prerequisite, or document it as a manual step.
9. **Loop until the user explicitly says "validated"** and every row is ✅. If the challenge reveals a missing step, update the diagram and table, then re-challenge.

## Input / Output

- **Input**: Ordered list of sub-actions from step 03.
- **Output**: Validated plan — ASCII diagram + validation table with all rows ✅ + user explicit approval.

## References

- No specific reference needed for this step.

## Test policy

- **Assertion**: The user has explicitly said "validated" AND every row in the validation table is ✅.
- **Exit condition**: User approval received AND no ❌ in the table.
- **Expected result**: Validated plan (diagram + table) ready for implementation.
- **Retry loop**: If any row is ❌, update the plan and re-present. Loop until all ✅. Hard stop after 5 full re-challenges: ask the user if they want to proceed with documented risks.
- **On failure**: List unresolved ❌ items and ask the user to decide: fix them, accept the risk, or abandon.
