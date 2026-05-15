# 03 - Execute or handoff

Apply the user's numeric choice from action 02. Run the skill, explain it, hand it off to a new session, swap the recommendation, or stop the loop.

## Inputs

- `stage` (required) - `A` (run/explain/handoff/swap/stop menu) or `B` (intent menu). Set by action 02.
- `choice` (required) - integer between 1 and 5 from action 02.
- `skill` (required) - the aidd-context skill identifier resolved by action 02 (from Stage 1 row or Stage 2 mapping). Ignored when Case B option 5 was picked.

## Outputs

The user sees one of five outcomes depending on `choice`. Every outcome ends with an explicit next instruction (either a re-detect loop or a stop).

| Choice | Outcome                                                                                                                                                       | Loop back to action 01? |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1      | Skill invoked inline in this session. After it finishes, ask the user to confirm the result in one word.                                                      | yes, after confirmation |
| 2      | Print a 3 to 5 line plain-text summary of the skill (purpose, expected output, side effects). Then re-render the menu from action 02.                          | no, re-render menu       |
| 3      | Print the exact invocation string (`/<skill-id>` or equivalent) for a new session. Ask the user to paste it into a fresh chat and report back.                | yes, after report-back  |
| 4      | Ask the user which aidd-context skill they want instead. Validate it is one of the six aidd-context skills. Then run the chosen skill with the same outcomes 1 to 3 menu. | yes, after execution    |
| 5      | Print a one-line goodbye listing the next likely step for the future ("when memory drifts, run `aidd-context:05:learn`"). End the loop.                       | no, terminate           |

## Process

1. **Branch on `choice`.** Implement each row in the table above. `skill` refers to whichever aidd-context skill action 02 resolved (Stage 1 row or Stage 2 mapping).
2. **Choice 1 - run inline.** Invoke `skill` the same way a slash command would. Stream its output. Once it returns, ask the user: `Result OK? Reply ok / not ok / explain.` Wait for the reply. On `ok`, return to action 01 to re-detect state. On `not ok`, ask one follow-up to capture what went wrong, then return to action 01.
3. **Choice 2 - explain.** Pull the `description` frontmatter from the `skill`'s `SKILL.md`. Render: 1 line purpose, 1 to 2 lines on what it produces, 1 line on side effects (writes to `aidd_docs/`, modifies AI context files, etc.). Do not invoke. Re-render the menu unchanged.
4. **Choice 3 - handoff.** Print: `Open a new session and run: /<skill-id>`. Then: `Reply done when you've come back with the result.` Wait. On `done`, return to action 01.
5. **Choice 4 - swap.** Ask: `Which aidd-context skill? Reply with its id (e.g. 05-learn).` Validate the id is in `{01-bootstrap, 02-project-init, 03-context-generate, 04-mermaid, 05-learn, 06-discovery}`. If not, repeat once. Once valid, set `skill` to the chosen id and re-enter this action from step 1 with a fresh Case A menu render.
6. **Choice 5 - stop.** Print the goodbye line. Terminate the skill cleanly. Do not loop.
7. **Never invent skills.** Never name a skill outside the six aidd-context skills. If the user pushes for one, redirect them to discovery via choice 4.

## Test

- Choice 1 produces a skill invocation and ends with a yes/no/explain prompt.
- Choice 2 produces a 3 to 5 line description and re-renders the menu without invoking anything.
- Choice 3 produces an exact `/skill-id` invocation string and a `done` wait state.
- Choice 4 only accepts one of the six aidd-context skill ids; any other input triggers a re-ask.
- Choice 5 prints a goodbye and the skill exits. No further actions run.
