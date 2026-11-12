# Skill authoring

The constraints every generated skill satisfies, this generator included. `scaffold-skill.cjs` writes the structure of a new skill, and `check-skill.cjs` reports each rule of the last table by its id.

## Judgment

| Id | Rule | Why |
| --- | --- | --- |
| R1 | One domain per skill, named per `naming.md`. | A skill with two domains triggers on the wrong request. |
| R2 | `description` is one third-person sentence, what then when. | It is the only always-on text. |
| R3 | A plugin source adds `argument-hint`: the requested cases or consumed artifacts, one or two words each, not action slugs. | Autocomplete shows it as the prompt for what to type. |
| R4 | Write in English unless the user asks for another language. | The tree is maintained in one language. |
| R5 | Emit a frontmatter field beyond those `tool-write.md` lists only when the plan needs it and the target's source supports it. | Each host reads a different set. |
| R8 | Draw every path: an entry per case, a back-edge per loop, a terminal per outcome, a stop or confirm branch from every node that can take it. An action may run alone, from its own entry to its own outcome. | A path missing from the diagram is invisible. |
| R9 | `## Transversal rules` holds the skill's own rules that more than one action follows. This generator's rules and these authoring rules stay out. | The router loads on every call. |
| R10 | Keep action detail in its action, and a judgment or looked-up fact (path, format, per-tool value) in a reference. | The router loads on every call. |
| R12 | Steps are imperative, one sentence each, cases as dash sub-items. A loop names the step it returns to. A check ends in validate, fix, repeat until it passes. | One sentence per step keeps each step checkable. |
| R13 | `## Output` is one line: what exists when the action is done. `## Input` names what it uses. Add a check step only when the action changes files or state. | Carried items repeat the action before. |
| R14 | `## Rules` holds whole-action constraints, one per line. | A step-level constraint belongs to its step. |
| R15 | A reference answers one question, stands alone, and names a sibling in backticks without a link. | A reference loads whole, and a link chain loads files the task does not need. |
| R16 | Use tables, Mermaid diagrams or lists, one fact per row; prose only when none fits. | A row is checked on its own. |
| R17 | An asset is a template an action fills. A slot holds the name of its value; one note states what to remove. | A leftover placeholder ships as a bug. |
| R18 | A script runs unedited, does one job, takes input by argument or stdin, and exits non-zero with a readable failure. Run it once on real input. | A caller can trust its exit code. |
| R19 | One fact, one home. Before adding an instruction, revise the one that already owns it. | Two copies drift apart. |
| R22 | One artifact per file. | A file with two artifacts loads both for either. |
| R23 | State a needed capability and let the host find the provider by description. Only an orchestrator reference names another skill or `/command`. | A named provider breaks when renamed or absent. |
| R24 | Point to content by purpose, not by line number or quoted anchor. | Line numbers and headings change. |
| R25 | Prefer positive instructions. Keep a boundary the source states with never as is. | A softened boundary stops being one. |
| R26 | Keep emitted fenced content in the format its consumer requires. | The consumer parses it as is. |

## Checked by `check-skill.cjs`

| Id | Rule |
| --- | --- |
| R2 | `description` under 150 characters, one sentence, no colon, no dash separator. |
| R6 | After the title, only the diagram and `## Transversal rules`. |
| R7 | The diagram is `flowchart LR`, one box per action file labeled with its relative path, and no other box. |
| R8 | Each edge leaving a node, but its default one, carries a quoted label; an edge between two actions is a link in the source action. |
| R11 | An action starts with `# <NN> - <Title>`, then only `## Input`, `## Process`, `## Output`, `## Rules`, in that order. |
| R12 | An action the diagram chains to another ends with a step linking it. |
| R17 | No comment and no unfilled slot outside an asset. |
| R20 | An action or a reference stays under 100 lines. |
| R21 | The first citation of a file is a relative link that resolves; later ones use its name in backticks. |
| R27 | No dates or ticket ids. |
| R28 | No bold. |
