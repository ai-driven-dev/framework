# Skill authoring

The constraints every generated skill satisfies, this generator included. `scaffold-skill.cjs` writes the structure of a new skill, and `check-skill.cjs` checks the form.

## Judgment

| Id | Rule | Why |
| --- | --- | --- |
| S1 | One domain per skill, named per Naming below. | A skill with two domains triggers on the wrong request. |
| S2 | `description` is one third-person sentence, what then when. | It is the only always-on text. |
| S3 | Write in English unless the user asks for another language. | The tree is maintained in one language. |
| S4 | Emit a frontmatter field beyond those `hosts.md` lists only when the plan needs it and the target's source supports it. | Each host reads a different set. |
| S5 | Draw every path: an entry per case, a back-edge per loop, a terminal per outcome, a stop or confirm branch no transversal rule states. An action may run alone, from its own entry. | A path missing from the diagram is invisible. |
| S6 | `## Transversal rules` holds the skill's own rules that more than one action follows. This generator's rules and these authoring rules stay out. | The router loads on every call. |
| S7 | Keep action detail in its action, and a judgment or looked-up fact (path, format, per-tool value) in a reference. | The router loads on every call. |
| S8 | Steps are imperative, one sentence each, cases as dash sub-items. A loop names the step it returns to. A check ends in validate, fix, repeat until it passes. | One sentence per step keeps each step checkable. |
| S9 | `## Output` is one line: what exists when the action is done. `## Input` names what it uses. Add a check step only when the action changes files or state. | Carried items repeat the action before. |
| S10 | `## Rules` holds whole-action constraints, and every rule list holds one rule per line, its case inside the sentence, no sub-items. | A step-level constraint belongs to its step. |
| S11 | A reference answers one question, stands alone, and names any other file in backticks without a link. | A reference loads whole, and a link chain loads files the task does not need. |
| S12 | Use tables, Mermaid diagrams or lists, one fact per row; prose only when none fits. | A row is checked on its own. |
| S13 | An asset is a template an action fills. A slot holds the name of its value; one note states what to remove. | A leftover placeholder ships as a bug. |
| S14 | A script runs unedited, does one job, takes input by argument or stdin, and exits non-zero with a readable failure. Run it once on real input. | A caller can trust its exit code. |
| S15 | One fact, one home. Before adding an instruction, revise the one that already owns it. | Two copies drift apart. |
| S16 | One artifact per file. | A file with two artifacts loads both for either. |
| S17 | Name another skill, agent or command only when shipped with it and the flow needs that exact one; otherwise state the capability. | A named provider breaks when renamed or absent. |
| S18 | Point to content by purpose, not by line number or quoted anchor. | Line numbers and headings change. |
| S19 | Prefer positive instructions. Keep a boundary the source states with never as is. | A softened boundary stops being one. |
| S20 | Keep emitted fenced content in the format its consumer requires. | The consumer parses it as is. |

## Naming

| Item | Rule | Example |
| --- | --- | --- |
| Skill of a tool | singular noun | `slack` |
| Skill of an activity | action verb | `review` |
| Skill format | kebab-case, at most 64 chars, equal to its folder | `^[a-z0-9]+(-[a-z0-9]+)*$` |
| Skill, reserved | never `anthropic` or `claude` | |
| Skill, avoid | redundant prefix, vague noun, gerund | `skill-slack`, `helper`, `reviewing` |
| Action | kebab-case verb phrase, `NN-` prefix when order is strict; the slug drops it | `01-post-message`, slug `post-message` |
