# Skill authoring

The constraints every generated skill satisfies. `skill-generate` obeys them too. How to fill each file is judgment, in `fill-norm.md`.

## The skill

- **R1.** One domain per skill; name it per `naming.md`.
- **R2.** Keep colons and invocation prefixes out of `name`: they break loading. In prose, use `plugin:folder`.
- **R3.** `description` is the only always-on text: one sentence, third person, what the skill does then when to use it, about 150 characters, no colon or dash.
- **R4.** In plugin source, `argument-hint` names requested cases (`setup | refresh | rewire`) or consumed artifacts (`request | epic`).
  - Use one or two words per case; avoid action slugs.
  - Omit it when no action declares `## Input`.
  - Native publication follows `tool-write.md`.
- **R5.** Prefer English unless the user requests another language.
- **R6.** `disable-model-invocation` and `hooks` are optional frontmatter. Add one only when the plan records an accepted risk step; host support follows `tool-write.md`.

## The router

- **R7.** After its title, keep only the diagram and `## Transversal rules`: no Actions heading, action table or generic reading instruction.
- **R8.** The diagram is `flowchart LR` with one node per action file, labeled only with its relative path (`actions/01-plan.md`). It is the only list of nodes.
- **R9.** Show every path in the diagram: an entry node per case, a back-edge per loop, a terminal per outcome, quoted edge labels for conditions.
- **R10.** Put rules no single action or reference owns in `## Transversal rules`; omit the section when none exists.
- **R11.** The router loads on every call; keep action and reference detail in those files.

## An action

- **R12.** Start with `# <NN> - <Title>` and one sentence naming the result.
  - Follow with `## Input` when needed, `## Process`, `## Output`, then `## Rules`.
  - Omit sections with no content; add none (no `## Test`, no done-when) and preserve this order.
- **R13.** Number imperative process steps in execution order, one sentence each.
  - Put cases, branches and step-specific constraints under their owning step as dash sub-items.
  - A return to an earlier point is a step naming its number or a link to the action.
  - A check ends in a step: `validate, fix, repeat until it passes`, linking the check, or naming the steps that hold it.
  - The final step reads the next action file, as a link; a terminal action has none.
- **R14.** `## Output` is the done condition: what exists when the action is finished.
- **R15.** `## Rules` holds whole-action constraints, one per line. Move rules shared by actions to the router's transversal rules.
- **R16.** An action stays under 100 lines.

## A reference

- **R17.** Keep references flat; nest one directory deep only for a load boundary. Each stands alone without pulling in another. Name siblings in backticks, without links.
- **R18.** Use tables, Mermaid diagrams or lists, one fact per row. Use prose only when none fits.
- **R19.** A reference stays under 100 lines.

## An asset

- **R20.** State how to fill the asset and what to remove. Leave no scaffold in the resulting artifact.

## A script

- **R21.** A script does one job, takes input by argument or stdin, runs without edits, and exits non-zero with a readable failure.

## Across all of them

- **R22.** One fact, one home: constraints in rules, judgment in references, the node list in the diagram. Actions apply router rules and cite references instead of restating either. Before adding or changing an instruction, check the whole skill for overlap or conflict; resolve it by revising the owning rule.
- **R23.** In each authoring file:
  - Use a relative Markdown link, `[name](path)`, for a file's first prose citation, except sibling references under R17.
  - For repeat mentions within that file, use the filename in backticks when unambiguous; otherwise retain the link.
  - Place citations in the sentence, step, output or rule using them, not on standalone lines.
  - Avoid unresolved `@` includes.
- **R24.** One artifact per file. Split artifacts only when a path needs one without the other.
- **R25.** State needed capabilities; the host discovers providers by description. Naming another skill or `/command`, including within the same plugin, is reserved for orchestrator references naming the providers they sequence.
- **R26.** Write short sentences, one idea each. Bold meaningful bullet openings instead of adding procedural labels.
- **R27.** Identify content to read or edit by purpose, not by line numbers, exact headings or quoted anchors. Retain exact names the artifact's format requires.
- **R28.** Prefer positive instructions or `avoid` over `never`. Express mandatory boundaries as explicit conditions.
- **R29.** Keep emitted fenced content in the format its consumer requires.
- **R30.** Write no dates or ticket IDs in any file.
