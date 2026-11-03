# Skill authoring

The contract every generated skill satisfies. `skill-generate` obeys it too.

## The skill

- **R1.** One domain per skill; name it per `naming.md`.
- **R2.** Keep colons and invocation prefixes out of `name`: they break loading. In prose, use `plugin:folder`.
- **R3.** `description` is the only always-on text. Use a verb-led, third-person description of about 240 characters: `Use when the user wants to <intents>`, optionally `Not for <X>`. Use no colon or dash.
- **R4.** In plugin source, `argument-hint` names requested cases (`setup | refresh | rewire`) or consumed artifacts (`request | epic`).
  - Use one or two words per case; avoid action slugs.
  - Omit it when no action declares `## Input`.
  - Native publication follows `tool-write.md`.
- **R5.** Prefer English unless the user requests another language.

## The router

- **R6.** After its title, keep only the flow and `## Transversal rules`: no Actions heading, action table or generic reading instruction.
- **R7.** Show every path in the Mermaid flow, including branches described in prose: the nominal chain by slug, an entry node per case, a back-edge per loop, a terminal per outcome, and quoted edge labels for conditions.
- **R8.** Label action nodes only with their relative file paths. Retain numbering, including when slugs repeat (`actions/01-plan.md`, `actions/04-plan.md`).
- **R9.** Put rules no single action or reference owns in `## Transversal rules`.
- **R10.** The router loads on every call; keep action and reference detail in those files.

## An action

- **R11.** Start with `# <NN> - <Title>` and one sentence naming the result.
  - Follow with `## Input` when needed, `## Process`, `## Output`, then `## Rules`.
  - Input names what the action consumes; Rules follows R13.
  - Omit sections with no content; add none and preserve this order.
- **R12.** Number imperative process steps in execution order, one sentence each.
  - Put cases, branches and step-specific constraints under their owning step as dash sub-items.
  - A loop may also use a step naming where to return.
  - Verify observable success through real execution without mocks, and handle failure.
  - When the flow continues, the final step names the next action file.
- **R13.** `## Rules` holds whole-action constraints, one per line. Move rules shared by actions to the router's transversal rules.

## A reference

- **R14.** Keep references flat; nest one directory deep only for a load boundary. Each stands alone without pulling in another. Name siblings in backticks, without links.
- **R15.** Use tables, Mermaid diagrams or lists, one fact per row. Use prose only when none fits.

## An asset

- **R16.** State how to fill the asset and what to remove. Leave no scaffold in the resulting artifact.

## Across all of them

- **R17.** One fact, one home. Actions apply router rules and cite shared references instead of restating either. Before adding or changing instructions, check the whole skill for overlap or conflict; resolve either by proposing a coherent revision of the owning rule.
- **R18.** In each authoring file:
  - Use a relative Markdown link, `[name](path)`, for a file's first prose citation, except sibling references under R14.
  - For repeat mentions within that file, use the filename in backticks when unambiguous; otherwise retain the link.
  - Place citations in the sentence, step, output or rule using them, rather than on standalone lines.
  - Avoid unresolved `@` includes.
- **R19.** One artifact per file. Split artifacts only when a path needs one without the other.
- **R20.** State needed capabilities; the host discovers providers by description. Naming another skill or `/command`, including within the same plugin, is reserved for orchestrator references naming the providers they sequence.
- **R21.** Write short sentences, one idea each. Group related instructions; use sub-items only when they improve readability. Bold meaningful bullet openings instead of adding procedural labels.
- **R22.** Identify content to read or edit by purpose, rather than line numbers, exact headings or quoted anchors. Retain exact names required by the artifact's format.
- **R23.** Prefer positive instructions or `avoid` over `never`. Express mandatory boundaries as explicit conditions.
- **R24.** Keep emitted fenced content in the format its consumer requires.
