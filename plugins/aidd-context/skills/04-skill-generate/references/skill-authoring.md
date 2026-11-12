# Skill authoring

The constraints every generated skill satisfies, this generator included.

## The skill

| Id | Rule | Why |
| --- | --- | --- |
| R1 | One domain per skill, named per `naming.md`. | A skill with two domains triggers on the wrong request. |
| R2 | `description` is one third-person sentence, what then when, under 150 characters, with no colon and no dash as a separator. | It is the only always-on text. |
| R3 | `argument-hint` names the requested cases (`setup \| refresh`) or consumed artifacts (`request \| epic`), one or two words each, not action slugs. Omit it when no action declares `## Input`. | Autocomplete shows it as the prompt for what to type. |
| R4 | Write in English unless the user asks for another language. | The tree is maintained in one language. |
| R5 | Add `disable-model-invocation` or `hooks` only for a risk step the plan accepted. | Each changes how the host runs the skill. |

## The router

| Id | Rule | Why |
| --- | --- | --- |
| R6 | After the title, keep only the diagram and `## Transversal rules`. | The diagram already lists the actions. |
| R7 | The diagram is `flowchart LR`, one box per action file labeled with its relative path (`actions/01-plan.md`). A reference is cited from its step, not drawn. | A second list drifts from the first. |
| R8 | Draw every path: an entry per case, a back-edge per loop, a terminal per outcome. Each edge leaving a node, but its default one, carries a quoted label stating the condition its action tests. A stop or confirm branch is drawn from every node that can take it. | A path missing from the diagram is invisible. |
| R9 | `## Transversal rules` holds the skill's own rules that more than one action follows. This generator's rules and these authoring rules stay out. Omit it when empty. | The router loads on every call. |
| R10 | Keep action detail in its action, and a judgment or looked-up fact (path, format, per-tool value) in a reference. | The router loads on every call. |

## An action

| Id | Rule | Why |
| --- | --- | --- |
| R11 | Start with `# <NN> - <Title>` and one sentence stating the result. Then `## Input` when needed, `## Process`, `## Output`, `## Rules`, in that order. | A fixed order lets a reader find each part by habit. |
| R11 | Omit an empty section and add no other. | Extra sections duplicate Output. |
| R12 | Number imperative steps in execution order, one sentence each. Cases and branches go under their step as dash sub-items. | One sentence per step keeps each step checkable. |
| R12 | A loop is a step naming the step number or linking the action it returns to. A check ends in validate, fix, repeat until it passes. | An implied loop is skipped. |
| R12 | The final step reads the next action as a link. A terminal action has none. | The chain of actions has no gap. |
| R13 | `## Output` is one line: what exists when the action is done. `## Input` names what it uses. Neither carries items for a later action. | Carried items repeat the action before. |
| R13 | Add a check step only when the action changes files or state. | A check on nothing is noise. |
| R14 | `## Rules` holds whole-action constraints, one per line. | A step-level constraint belongs to its step. |

## A reference

| Id | Rule | Why |
| --- | --- | --- |
| R15 | A reference answers one question and stands alone. Keep references flat; nest one level only for a load boundary. | A reference loads whole for any of its questions. |
| R15 | A reference names a sibling in backticks, without a link, as the exception to R21. | A link chain loads files the task does not need. |
| R16 | Use tables, Mermaid diagrams or lists, one fact per row; prose only when none fits. | A row is checked on its own. |

## An asset

| Id | Rule | Why |
| --- | --- | --- |
| R17 | An asset is a template an action fills, in any format. A slot holds the name of its value. One note states what to remove; nothing of the scaffold stays in the result. | A leftover placeholder ships as a bug. |
| R17 | A comment lives only in an asset. For a format without comments (JSON), the filling action holds the note. | A model reads a stray comment as an instruction. |

## A script

| Id | Rule | Why |
| --- | --- | --- |
| R18 | A script runs unedited, does one job, takes input by argument or stdin, and exits non-zero with a readable failure. Run it once on real input. | A caller can trust its exit code. |

## Across all of them

| Id | Rule | Why |
| --- | --- | --- |
| R19 | One fact, one home: constraints in rules, judgment in references, shapes in assets, the node list in the diagram. Others cite it. Before adding an instruction, revise the one that already owns it. | Two copies drift apart. |
| R20 | An action or a reference stays under 100 lines. | Past that length it holds several jobs. |
| R21 | The first citation of another file in a file is a relative link, `[name](path)`, inside the sentence using it. Repeat mentions use the filename in backticks, not a second link. | The link opens the file; the exact name leaves nothing to guess. |
| R22 | One artifact per file: a unit a path can need on its own. | A file with two artifacts loads both for either. |
| R23 | State a needed capability and let the host find the provider by description. Only an orchestrator reference names another skill or `/command`. | A named provider breaks when renamed or absent. |
| R24 | Point to content by purpose, not by line number or quoted anchor. Keep a heading exact only when a format or cited document requires it. | Line numbers and headings change. |
| R25 | Prefer positive instructions. Keep a boundary the source states with never as is; state a new one as an explicit condition. | A softened boundary stops being one. |
| R26 | Keep emitted fenced content in the format its consumer requires. | The consumer parses it as is. |
| R27 | No dates or ticket ids. A date-format placeholder such as `<yyyy_mm>` is allowed. | They go stale. |
| R28 | No bold. | A bold label adds weight to every load. |
