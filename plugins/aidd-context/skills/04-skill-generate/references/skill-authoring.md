# Skill authoring

The constraints every generated skill satisfies, this generator included. `scaffold-skill.cjs` writes the structure of a new skill, and `validate-skill.cjs` checks the form.

## Judgment

| Id | Rule | Why |
| --- | --- | --- |
| R1 | One domain per skill, named per `naming.md`. | A skill with two domains triggers on the wrong request. |
| R2 | `description` is one third-person sentence, what then when. | It is the only always-on text. |
| R3 | Write in English unless the user asks for another language. | The tree is maintained in one language. |
| R4 | Emit a frontmatter field beyond those `tool-write.md` lists only when the plan needs it and the target's official source supports it. | Each host reads a different set. |
| R5 | Draw every path: an entry per case, a back-edge per loop, a terminal per outcome, a stop or confirm branch no transversal rule states. An action may run alone, from its own entry. | A path missing from the diagram is invisible. |
| R6 | Use `## Transversal rules` only for shared constraints not already enforced elsewhere; exclude generator and authoring rules. | The router loads on every call. |
| R7 | Keep action detail in its action, and a judgment or looked-up fact (path, format, per-host value) in a reference. | The router loads on every call. |
| R8 | A step is one imperative sentence doing one action on a named object. A case is a dash sub-item that opens with its condition. Three or more things to present go in sub-items or a template. A loop names the step it returns to. A check ends in validate, fix, repeat until it passes. | A step holding two actions is read as one. |
| R9 | `## Output` is one line: what exists when the action is done. `## Input` names what it uses. Add a check step only when the action changes files or state. | Carried items repeat the action before. |
| R10 | `## Rules` holds whole-action constraints, and every rule list holds one rule per line, its case inside the sentence, no sub-items. | A step-level constraint belongs to its step. |
| R11 | A reference answers one question, stands alone, and names a sibling in backticks without a link. | A reference loads whole, and a link chain loads files the task does not need. |
| R12 | Use tables, Mermaid diagrams or lists, one fact per row; prose only when none fits. | A row is checked on its own. |
| R13 | An asset is a template an action fills. A slot is written `{{name}}` and holds the name of its value; one note states what to remove. | A leftover placeholder ships as a bug. |
| R14 | A script runs unedited, does one job, takes input by argument or stdin, and exits non-zero with a readable failure. Run it once on real input. | A caller can trust its exit code. |
| R15 | One fact, one home, one sense per term. State nothing a script, template, reference or other step already does or contradicts; revise the instruction that owns it. | Two copies drift apart, and a model follows each copy or sense it reads. |
| R16 | One artifact per file. | A file with two artifacts loads both for either. |
| R17 | Name another skill, agent or command only when shipped with it and the flow needs that exact one; otherwise state the capability. | A named provider breaks when renamed or absent. |
| R18 | Point to content by purpose, not by line number or quoted anchor. | Line numbers and headings change. |
| R19 | Prefer positive instructions. Keep a boundary the source states with never as is. | A softened boundary stops being one. |
| R20 | Keep emitted fenced content in the format its consumer requires. | The consumer parses it as is. |

