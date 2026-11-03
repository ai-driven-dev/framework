# Skill authoring

The contract every generated skill satisfies. `skill-generate` obeys it too.

## The skill

- **R1.** One skill, one domain. Named per `naming.md`.
- **R2.** `name` is not the invocation token: a colon or prefix breaks loading. In prose call a skill `plugin:folder`.
- **R3.** `description` is the only always-on text: verb-led, third person, about 240 chars, `Use when the user wants to <intents>` and an optional `Not for <X>`. No colon or dash, no other skill or `/command` named.
- **R4.** In plugin source, `argument-hint` names what the user brings: the cases they can ask for (`setup | refresh | rewire`) or the artifact consumed (`request | epic`). One or two words per case; avoid action slugs. Omit when no action declares an `## Input`. Native publication follows `tool-write.md`.
- **R5.** Prefer English unless the user requests another language.

## The router

- **R6.** After its title, the router holds the flow and `## Transversal rules`, without an Actions heading, action table or generic reading instruction.
- **R7.** The mermaid flow shows every path a run can take: the nominal chain by slug, one entry node per case, a back-edge per loop, a terminal node per outcome, each condition as a quoted edge label. A branch stated in prose is a branch missing from the flow.
- **R8.** Each action node names its slug and relative file path, such as `actions/01-scope.md`. Two actions sharing a slug keep their number (`01-plan`, `04-plan`).
- **R9.** `## Transversal rules` holds the rules no single action or reference owns. A rule stated there is stated nowhere else.
- **R10.** The router is loaded on every call, an action only when its turn comes: the router carries nothing an action or a reference could carry.

## An action

- **R11.** `# <NN> - <Title>`, then one sentence: what the action produces. Then `## Input` when the action consumes something, `## Process`, `## Output`, and `## Rules` when a constraint holds for the whole action. A section earns its content or is omitted, never invented or reordered.
- **R12.** A `## Process` step is one imperative sentence, numbered in run order. Cases, branches and step-specific constraints are dash sub-items of their step; a loop can also use a step naming where to return. Verify observable success through real execution without mocks, and handle failure. When the flow continues, the last step names the next action file.
- **R13.** `## Rules` holds what the action must or must not do throughout, one per line. A rule two actions share belongs to the router's transversal rules.

## A reference

- **R14.** References stay flat, nesting one directory deep only as a load boundary. Each stands alone, never pulling in another. It names a sibling in backticks and never links it.
- **R15.** A reference carries one fact per row: a table, a mermaid, or a list. Prose is what is left when neither fits.

## An asset

- **R16.** An asset states how it is filled and what is removed. Nothing of its scaffold survives in the artifact produced from it.

## Across all of them

- **R17.** One fact, one home. An action applies router rules and cites shared references instead of restating them. Before adding or changing instructions, check the whole skill for overlap or conflict; resolve either by proposing a coherent revision of the owning rule.
- **R18.** The first prose citation of a file in each authoring file is a relative Markdown link, `[name](path)`, except for sibling references under R14. Repeat mentions within that same file use its filename in backticks when unambiguous; retain the link otherwise. Use relative Markdown links rather than unresolved `@` includes. Place each citation in the sentence, process step, output or rule that uses it, rather than on its own line.
- **R19.** One file, one artifact. Split two apart only when a path needs one without the other.
- **R20.** No file names another skill or `/command`, its own plugin's included: it states the capability it needs, and the host finds a provider by description. Only an orchestrator's references name the providers they sequence.
- **R21.** Write for scanning: short sentences, one idea each. Group related instructions; use sub-items only when they improve readability. In bullets, bold important opening words instead of adding procedural labels.
- **R22.** Identify content to read or edit by purpose, rather than line numbers, exact headings or quoted anchors. Retain exact names required by the artifact's format.
- **R23.** Prefer positive instructions or `avoid` over `never`. Express mandatory boundaries as explicit conditions.
- **R24.** Keep emitted fenced content in the format its consumer requires.
