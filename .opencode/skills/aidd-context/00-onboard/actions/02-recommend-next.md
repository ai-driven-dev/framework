# 02 - Recommend next

Turn the Stage 1 snapshot from action 01 into ONE concrete next step. When Stage 1 returns `ask`, render the Stage 2 intent menu first to discover the user's situation, then propose the matched skill.

## Inputs

- State snapshot block emitted by `actions/01-detect-state.md` (held in conversation context).

## Outputs

Two possible renderings, depending on Stage 1.

### Case A - Stage 1 matched a setup row (rows 1 to 3)

```text
Analysis: <one line summary of detected state>

Next step: <skill name> - <one-line purpose>

Choose:
  1. Run it now in this session
  2. Explain what it will do, then ask again
  3. Hand off: tell me the command to run in a new session
  4. Pick a different aidd-context skill
  5. Stop the onboard loop
```

### Case B - Stage 1 returned `ask` (row 4)

```text
Analysis: Setup looks complete. What brings you here?

  1. I need to capture a learning, decision, or new convention
  2. I want to add or update a Mermaid diagram
  3. I want to generate a new skill, agent, or rule
  4. I want to see every installed skill across plugins, not just aidd-context
  5. I'm just exploring, nothing to do right now

Reply with a digit between 1 and 5.
```

After the user picks an option in Case B, the action maps it to a skill via the Stage 2 table in `state-matrix.md` and re-renders the Case A run/explain/handoff menu for that skill. Option 5 in Case B prints a one-line goodbye and ends the loop.

## Process

1. **Read the snapshot**. Pull `matched_row` and `recommended_skill` from the action 01 output.
2. **Branch on `recommended_skill`**.
   - `aidd-context:01:bootstrap` or `aidd-context:02:project-init` -> Case A.
   - `ask` -> Case B, then Case A on the resolved skill.
3. **Case A render**.
   - One analysis line. Mention only the signals that decided the row (e.g., "Memory bank is empty - the project memory block is the prerequisite for every other skill").
   - One next-step line. Name the recommended skill and its purpose. Never list more than one skill.
   - The 5-option run/explain/handoff/swap/stop menu in the exact order shown.
4. **Case B render**.
   - One analysis line confirming setup is complete.
   - The 5 numbered situations from `state-matrix.md` Stage 2, in order.
   - The digit reminder line.
5. **Wait for a numeric reply.** Stop until the user answers.
6. **Reject non-numeric input.** If the user replies with free text, repeat the same menu unchanged and append: `Reply with a digit between 1 and 5.` Do not interpret the text.
7. **Case B chaining**. When the user picks a situation in Case B:
   - Map it to the skill via the Stage 2 table.
   - For option 5 (stop), print a one-line goodbye and exit the skill cleanly.
   - For options 1 to 4, render Case A for the resolved skill, then wait for the user's run/explain/handoff/swap/stop reply.
8. **Challenge conflicting picks**. If the user invoked option 4 in Case A and names a skill that does not match `matched_row`, surface the conflict in one sentence (`Detected state recommends X. You asked for Y. Confirm?`) before accepting.
9. **Pass the choice to action 03**. The handoff payload is `{ stage: A|B, choice: <int>, skill: <skill> }`.

## Test

- Stage 1 rows 1 to 3 produce Case A only: one analysis line, one next-step line, the 5-option run/explain/handoff/swap/stop menu.
- Stage 1 row 4 produces Case B first; after the user picks 1 to 4, Case A re-renders for the resolved skill; picking 5 ends the loop with a goodbye line.
- Any free-text reply at either case triggers a re-render plus the digit reminder line.
- The action never auto-proposes `aidd-context:06:discovery`. It is reachable only via Case B option 4.
