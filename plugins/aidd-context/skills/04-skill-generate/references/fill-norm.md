# Fill norm

How to fill each file kind, by three questions in order. The rules each kind satisfies live in `skill-authoring.md`, under its section.

| Question | Asks |
| --- | --- |
| Do in order | the steps that produce the file |
| Consult | what to read before writing |
| Fill | what goes in, and what stays out |

Writing follows "Do in order". Validation checks "Fill".

## SKILL.md

| Question | Answer |
| --- | --- |
| Do in order | Write the description. Draw the diagram from the plan. Add the transversal rules. |
| Consult | the frame or the existing skill, the plan, `naming.md` |
| Fill | the description says what, then when |
| Fill | the diagram holds every path of the plan |
| Fill | rules state the skill's own behavior that no action owns |
| Fill | rules exclude this generator's rules, authoring rules, and rules a reference holds |

## Action

| Question | Answer |
| --- | --- |
| Do in order | State the result. List the input. Write the steps, a check step if R14 asks, then the read-next step. State the output. |
| Consult | the plan row, the references the steps cite |
| Fill | one sentence per step |
| Fill | a judgment or a looked-up fact (path, format, per-tool value) goes in a cited reference |
| Fill | a constraint goes in Rules or the router |

## Reference

| Question | Answer |
| --- | --- |
| Do in order | Name the one question it answers. Collect the facts. Pick the form that fits each. |
| Consult | the actions that cite it, to avoid a second copy of a fact |
| Fill | a table, diagram or list, one fact per row; judgment only |

## Asset

| Question | Answer |
| --- | --- |
| Do in order | Copy the output shape. Mark each slot. Add the fill note last. |
| Consult | the action that fills it |
| Fill | slots named by their value, plus one removal note per R20 |

## Script

| Question | Answer |
| --- | --- |
| Do in order | Decide the input and output. Write the smallest program. Run it on real input. |
| Consult | the action that runs it, for the exact call |
| Fill | one job, nothing the action already states |
