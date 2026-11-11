# Fill norm

How to fill each file kind, by four questions in order. The rules live in `skill-authoring.md`.

| Question | Asks |
| --- | --- |
| Do in order | the steps that produce the file |
| Consult | what to read before writing |
| Fill | what goes in, and what stays out |
| Always true | the rule ids the finished file satisfies |

Writing follows "Do in order". Validation checks "Fill" and "Always true".

## Every file kind

| Question | Answer |
| --- | --- |
| Always true | R5, R22 to R31, plus the ids of its kind |

## SKILL.md

| Question | Answer |
| --- | --- |
| Do in order | Write the description. Draw the diagram from the plan. Add the transversal rules. |
| Consult | the frame or the existing skill, the plan, `naming.md` |
| Fill | the description says what, then when |
| Fill | the diagram holds every path of the plan |
| Fill | rules state the skill's own behavior that no action owns |
| Fill | rules exclude this generator's rules, authoring rules, and rules a reference holds |
| Always true | R1, R2, R3, R4, R6, R7, R8, R9, R10, R11 |

## Action

| Question | Answer |
| --- | --- |
| Do in order | State the result. List the input. Write the steps, a check step if R14 asks, then the read-next step. State the output. |
| Consult | the plan row, the references the steps cite |
| Fill | one sentence per step |
| Fill | a judgment or a looked-up fact (path, format, per-tool value) goes in a cited reference |
| Fill | a constraint goes in Rules or the router |
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
| Fill | slots named by their value, plus one removal note per R20 |
| Always true | R20 |

## Dropped facts

Where an existing skill's fact goes when the lean rules leave it no home. The plan lists each drop and each addition for the user to confirm.

| Fact | Goes to |
| --- | --- |
| A "Not for" clause in the description | a transversal rule if it changes behavior, else dropped |
| What R7 removes from the router | dropped, not moved |
| A `## Test` section (R12) | dropped if Output or a check step holds it, else one clause of Output |
| A bold label (R31) | the plain sentence, label dropped |
| A procedure in a reference (R18) | an action step |
| A per-tool fact in an action step | the reference the step cites |
| A fill note inside a slot (R20) | the asset's note, or the filling action for JSON |

## Script

| Question | Answer |
| --- | --- |
| Do in order | Decide the input and output. Write the smallest program. Run it on real input. |
| Consult | the action that runs it, for the exact call |
| Fill | one job, nothing the action already states |
| Always true | R21 |
