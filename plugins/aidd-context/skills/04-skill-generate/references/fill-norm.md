# Fill norm

How to fill each file kind. Four questions, asked in this order. The constraints themselves live in `skill-authoring.md`; the last column cites their ids.

| Question | Asks |
| --- | --- |
| Do in order | the steps that produce the file |
| Consult | what to read before writing |
| Fill | what goes in, and what stays out |
| Always true | the rules the finished file satisfies |

## SKILL.md

| Question | Answer |
| --- | --- |
| Do in order | Write the description from the frame's purpose. Draw the diagram from the plan's rows and their branches and outcomes. Add the transversal rules. Remove `argument-hint` when no action has `## Input`. |
| Consult | the confirmed frame, the plan table, `naming.md` |
| Fill | the description says what then when; the diagram holds every entry, loop, user question and outcome the plan names; rules cover only what no action owns |
| Always true | R3, R4, R7, R8, R9, R10 |

## Action

| Question | Answer |
| --- | --- |
| Do in order | State the result in one sentence. List the input. Write the steps. Put the check in a step that loops until it passes. Name the next action in the last step. State the output. |
| Consult | the plan row, the references the steps cite |
| Fill | one sentence per step; a judgment call points to a reference; a constraint goes in Rules or the router |
| Always true | R12, R13, R14, R15, R16 |

## Reference

| Question | Answer |
| --- | --- |
| Do in order | Name the one question it answers. Collect the facts. Pick the form that fits each. |
| Consult | the actions that cite it, to avoid a second copy of a fact |
| Fill | a table, diagram or list, one fact per row; judgment only |
| Always true | R17, R18, R19, R22 |

## Asset

| Question | Answer |
| --- | --- |
| Do in order | Copy the output shape. Mark each slot. Add the fill note last. |
| Consult | the action that fills it |
| Fill | slots only, plus a single note on what to remove |
| Always true | R20 |

## Script

| Question | Answer |
| --- | --- |
| Do in order | Decide the input and output. Write the smallest program. Run it on real input. |
| Consult | the action that runs it, for the exact call |
| Fill | one job, nothing the action already states |
| Always true | R21 |
