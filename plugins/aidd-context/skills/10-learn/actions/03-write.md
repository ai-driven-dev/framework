# 03 - Write

Write each approved lesson to the destination the user chose.

## Input

The approved plan from action 02.

## Output

The created or updated files, and a summary table.

## Process

1. **Write by destination:**
   - **Memory.** Update the matching memory file at the root of the bank. Touch only the relevant section, and replace an entry the lesson supersedes rather than adding a contradicting one. Preserve the user's edits.
   - **Decision.** Write a record in `aidd_docs/memory/internal/decisions/` from `@../assets/decision-template.md`, named by a short slug. Create the folder if absent.
   - **Rule.** Hand the convention to the rule generator. Never write a rule file here.
   - **Skill.** Hand the intent to the skill generator. Never write a skill file here.
2. **Report.** A table: lesson, destination, action taken (created, updated, or handed off).

## Test

- Every approved lesson appears in the table. A decision lands as a record in the decisions folder. No rule or skill file was written by learn, and nothing was written into AIDD's own scaffold.
