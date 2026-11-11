# Fill norm

How to fill each file kind. Four questions, asked in this order. The constraints themselves live in `skill-authoring.md`; "Always true" lists the ids that apply to a kind.

| Question | Asks |
| --- | --- |
| Do in order | the steps that produce the file |
| Consult | what to read before writing |
| Fill | what goes in, and what stays out |
| Always true | the rule ids the finished file satisfies |

"Do in order" is for writing a file. A validation checks "Fill" and "Always true".

## Every file kind

| Question | Answer |
| --- | --- |
| Always true | R5, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31, besides the ids of its own kind below |

## SKILL.md

| Question | Answer |
| --- | --- |
| Do in order | Write the description from the frame's purpose. Draw the diagram from the plan's rows and their branches and outcomes. Add the transversal rules. |
| Consult | the confirmed frame (an existing skill has none: its input is the skill read in place), the plan table, `naming.md` |
| Fill | the description says what then when; the diagram holds every path the plan names, per R9; rules cover only what no action owns |
| Always true | R1, R2, R3, R4, R6, R7, R8, R9, R10, R11 |

## Action

| Question | Answer |
| --- | --- |
| Do in order | State the result in one sentence. List the input. Write the steps. Add a check step that loops until it passes only when R14 asks for one. Name the next action in the last step. State the output. |
| Consult | the plan row, the references the steps cite |
| Fill | one sentence per step; a judgment call points to a reference; a constraint goes in Rules or the router |
| Always true | R12, R13, R14, R15, R16 |

## Reference

| Question | Answer |
| --- | --- |
| Do in order | Name the one question it answers. Collect the facts. Pick the form that fits each. |
| Consult | the actions that cite it, to avoid a second copy of a fact |
| Fill | a table, diagram or list, one fact per row; judgment only |
| Always true | R17, R18, R19 |

## Asset

| Question | Answer |
| --- | --- |
| Do in order | Copy the output shape. Mark each slot. Add the fill note last. |
| Consult | the action that fills it |
| Fill | slots only, each the name of its value, plus the single note on what to remove, placed per R20 |
| Always true | R20 |

## Dropped facts

Where a fact of an existing skill goes when the lean rules leave it no home. The plan lists each drop, and each fact the lean form adds (a fix loop, a terminal, a read-next step), for the user to confirm.

| Fact | Goes to |
| --- | --- |
| A "Not for" exclusion in the old description | `## Transversal rules` when it changes behavior, else dropped |
| What R7 removes from the router | dropped, not moved |
| A `## Test` section (R12) | folded into `## Output`, or dropped when Output states it |
| A bold label (R31) | the plain sentence, label dropped |
| A procedure in a reference (R18) | an action step, the reference keeps judgment |

## Script

| Question | Answer |
| --- | --- |
| Do in order | Decide the input and output. Write the smallest program. Run it on real input. |
| Consult | the action that runs it, for the exact call |
| Fill | one job, nothing the action already states |
| Always true | R21 |
