---
name: 'aidd:01:onboard'
description: 'Detect project state and tell the user exactly what to run next'
---

# Onboard

## Goal

Detect where the user stands, share a brief analysis, then guide them to one concrete next action.

## Context

### Framework guide

```markdown
@aidd_docs/README.md
```

## Rules

- Always follow the framework guide to detect project state
- Always complete the full loop
- Never stop after detection or analysis
- One next action only, no list, no overview
- ALWAYS offer the choice
- Never assume the user will run the command in this conversation
- Always ask for feedback after the command is run
- Number given by the user must be used to identify the choice, never the text

## Steps

1. Detect project state based on documentation
2. Share a one-line analysis of what was found
3. Present numbered choices to identify the user's situation based on documentation advice or to explain documentation sections
4. **WAIT FOR USER RESPONSE**
   1. If user select a choice to get more info
      1. Explain it clearly and concisely
      2. Propose to deep dive into specific knowledge based on given explanation
      3. Always offer the choice to go back to step 3
   2. If user selects a choice to run a command, proceed to step 5
5. Explain the user about the next step and what it will do
6. Give the user numbered choices : to run it now in this conversation, start a new session to run it themselves or go back to step 3 to select another option
7. **WAIT FOR USER RESPONSE**
8. If run now
   1. Launch the command in subprocess
   2. Wait for it to complete
   3. Share the output to the user and ask to confirm it looks right
   4. **WAIT FOR USER RESPONSE**
   5. Then return to step 1 and loop
9. If new session,
   1. Tell the user which command to run and stop
   2. Ask the user to give feedback on the results
   3. **WAIT FOR USER RESPONSE**
   4. Then return to step 1 and loop
