# SA-05: Write files

Create all skill files at the chosen path using the templates.

## Instructions

1. Read `references/skill-template.md` for the SKILL.md template.
2. Read `references/sub-action-template.md` for the sub-action file template.
3. Write the SKILL.md orchestrator at the chosen path. Fill in:
   - Frontmatter (name, description with trigger keywords)
   - Context (goal, tools, trigger)
   - Transversal rules (IF/THEN format)
   - Execution flow (ordered list of sub-action files)
   - References (list of documentation files)
4. Write each sub-action file under `sub-actions/`. Fill in:
   - Instructions (step-by-step, imperative, each step starts with a verb)
   - Input / Output
   - References (pointers to documentation files)
   - Test policy (assertion, exit condition, expected result, retry loop, on failure)
5. Write each reference file under `references/`. References have no fixed format — use whatever structure fits the content (tables, lists, prose, code samples). One file per knowledge domain. Each must be self-contained and readable by an agent with no prior context.
6. If secrets are needed, write `.env` and `.env.local`.
7. Fill every field — no placeholders. If information is missing, ask.

## Input / Output

- **Input**: Validated plan from step 04 + skill path from step 01.
- **Output**: All skill files written at the chosen path.

## References

- Read `references/skill-template.md` for the SKILL.md structure.
- Read `references/sub-action-template.md` for the sub-action structure.

## Test policy

- **Assertion**: All files exist at the chosen path AND no file contains placeholder text like `<...>` or `TODO`.
- **Exit condition**: `ls <skill-path>/` shows SKILL.md, sub-actions/, and references/ with all expected files.
- **Expected result**: Complete file tree matching the validated plan.
- **Retry loop**: If a file has missing fields, fill them. If information is needed, ask the user. Loop until all files are complete. Hard stop after 3 rounds: flag incomplete files.
- **On failure**: Report which files are incomplete and what information is missing.
