# Skill authoring

The constraints every generated skill satisfies. `skill-generate` obeys them too. How to fill each file is judgment, in `fill-norm.md`.

## The skill

| Id | Rule | Why |
| --- | --- | --- |
| R1 | One domain per skill; name it per `naming.md`. | A skill with two domains triggers on the wrong request. |
| R2 | Keep colons and invocation prefixes out of `name`. In prose, use `plugin:folder`. | A colon in `name` breaks loading. |
| R3 | `description` is one sentence, third person, saying what the skill does then when to use it, under 150 characters, with no colon, and no dash used as a separator (a hyphen inside a word is fine). | It is the only always-on text, so every extra word is paid on every call. |
| R4 | In plugin source, `argument-hint` names requested cases (`setup \| refresh`) or consumed artifacts (`request \| epic`). | Autocomplete shows it as the prompt for what to type. |
| R4 | Use one or two words per case and avoid action slugs. | Slugs are internal and say nothing to the user. |
| R4 | Omit `argument-hint` when no action declares `## Input`. | A hint with nothing to take misleads. |
| R4 | Native publication follows `tool-write.md`. | Hosts differ in what they support. |
| R5 | Prefer English unless the user requests another language. | The tree is maintained in one language. |
| R6 | `disable-model-invocation` and `hooks` are optional frontmatter. Add one only when the plan records an accepted risk step. Host support follows `tool-write.md`. | Each one changes how the host runs the skill. |

## The router

| Id | Rule | Why |
| --- | --- | --- |
| R7 | After its title, keep only the diagram and `## Transversal rules`: no Actions heading, action table or generic reading instruction. | The diagram already lists the actions. |
| R8 | The diagram is `flowchart LR` with one node per action file, labeled only with its relative path (`actions/01-plan.md`). It is the only list of action nodes; entry, user-question and terminal nodes are allowed besides them. | A second list drifts from the first. |
| R9 | Show every path in the diagram: an entry node per case, a back-edge per loop, a terminal per outcome. Each quoted edge label states the condition its action tests, and each stop or confirm branch of an action, or stop a transversal rule names, is an edge or terminal drawn from every node that can take it. | A path or label that differs from the action is invisible or misleading to the reader. |
| R10 | Put rules no single action or reference owns in `## Transversal rules`. Omit the section when none exists. | An empty section is noise. |
| R11 | Keep action and reference detail in their own files. | The router loads on every call. |

## An action

| Id | Rule | Why |
| --- | --- | --- |
| R12 | Start with `# <NN> - <Title>` and one sentence stating what the action achieves, as an imperative or the result. | The number fixes the order in the tree. |
| R12 | Follow with `## Input` when needed, `## Process`, `## Output`, then `## Rules`, in that order. | A fixed order lets a reader find each part by habit. |
| R12 | Omit sections with no content and add none, such as `## Test` or a done-when. | Extra sections duplicate Output. |
| R13 | Number imperative process steps in execution order, one sentence each. | One sentence per step keeps each step checkable. |
| R13 | Put cases, branches and step-specific constraints under their owning step as dash sub-items. | The constraint stays next to the step it governs. |
| R13 | A return to an earlier point is a step naming its number or a link to the action. | The loop is explicit, not implied. |
| R13 | A check ends in a step: validate, fix, repeat until it passes, linking the check or naming the steps that hold it. | A check with no loop is only advice. |
| R13 | The final step reads the next action file, as a link. A terminal action has none. | The chain of actions has no gap. |
| R14 | `## Output` is the done condition and the action's check: what exists when the action is finished. Add a check step only when the action changes files or state. | The next action needs a clear start state. |
| R14 | An action consumes only an artifact its own `## Input` or the previous action's `## Output` carries. | A step reading what no earlier part supplies has no source. |
| R15 | `## Rules` holds whole-action constraints, one per line. Move rules shared by actions to the router's transversal rules. | A constraint repeated in each action gets edited in one and not the others. |
| R16 | An action stays under 100 lines. | Past that length an action holds several jobs. |

## A reference

| Id | Rule | Why |
| --- | --- | --- |
| R17 | Keep references flat and nest one directory deep only for a load boundary. | A deep tree hides files from a reader who lists the top level. |
| R17 | Each reference stands alone without pulling in another. Name siblings in backticks, without links. | A link chain loads files the task does not need. |
| R18 | Use tables, Mermaid diagrams or lists, one fact per row. Use prose only when none fits. | A row is checked on its own; a sentence mixes several facts. |
| R19 | A reference stays under 100 lines. | A reference loads whole, so its size is paid on every load. |

## An asset

| Id | Rule | Why |
| --- | --- | --- |
| R20 | State what to remove once. Leave no scaffold in the resulting artifact. A slot holds the name of its value, not a fill note. | A leftover placeholder ships as a bug. |
| R20 | An asset is a template an action fills, whatever its format, such as a `.sh` template. A file run unedited is a script (R21). | The kind decides who owns the fill note. |
| R20 | Put that note in the asset when its format takes comments, and the action does not repeat it. For a format with no comment (JSON), put it in the action that fills it. | One home for the note, and a JSON asset cannot hold it. |

## A script

| Id | Rule | Why |
| --- | --- | --- |
| R21 | A script does one job, takes input by argument or stdin, runs without edits, and exits non-zero with a readable failure. | A caller can run it and trust its exit code. |

## Across all of them

| Id | Rule | Why |
| --- | --- | --- |
| R22 | One fact, one home: constraints in rules, judgment in references, the node list in the diagram. Actions apply router rules and cite references instead of restating either. | Two copies of a fact drift apart. |
| R22 | An asset is the home of an output's shape, a reference of the judgment on choosing and filling it. Neither restates the other. | A shape held in both drifts. |
| R22 | Before adding or changing an instruction, check the whole skill for overlap or conflict, and resolve it by revising the owning rule. | A parallel rule contradicts the first. |
| R23 | In each authoring file, the first citation of another file, in a step, output or rule, is a relative Markdown link, `[name](path)`, not backticks, except sibling references under R17. | The first mention lets the reader open the file. |
| R23 | For repeat mentions within that file, use the filename in backticks when unambiguous. Otherwise retain the link. | Repeated links add noise. |
| R23 | Place citations in the sentence, step, output or rule using them, not on standalone lines. | A citation outside its use is easy to skip. |
| R23 | Avoid unresolved `@` includes. | An include that does not resolve loads nothing. |
| R24 | One artifact per file, an artifact being a unit a path can need on its own (a table, a template, a script). Split artifacts only when a path needs one without the other. | A file with two artifacts loads both for either. |
| R25 | State needed capabilities and let the host discover providers by description. Naming another skill or `/command`, including within the same plugin, is reserved for orchestrator references naming the providers they sequence. | A named provider breaks when it is renamed or absent. |
| R26 | Write short sentences, one idea each. Open a rule with the instruction itself, not a label. | A long sentence hides which part is the instruction. |
| R27 | Identify content to read or edit by purpose, not by line numbers, exact headings or quoted anchors. Keep as an exact name any heading the artifact's format or a cited document requires. | Line numbers and headings change as files are edited. |
| R28 | Prefer positive instructions or `avoid` over `never`, and express mandatory boundaries as explicit conditions. This holds in every file, including a reference cell: a cell states a fact or a condition. | A condition says when the boundary applies. |
| R29 | Keep emitted fenced content in the format its consumer requires. | The consumer parses it as is. |
| R30 | Write no dates or ticket IDs in any file. A date-format placeholder such as `<yyyy_mm>` is allowed. | They go stale and carry no lasting meaning. |
| R31 | Use no bold in a generated skill; write plain sentences. | A bold lead-in is a label that adds weight to every load and loses meaning when repeated. |
