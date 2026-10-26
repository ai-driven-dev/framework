# Skill authoring

The contract every generated skill satisfies. `skill-generate` obeys it too.

## The skill

- **R1.** One skill, one domain. Named per `naming.md`.
- **R2.** `name` is not the invocation token: a colon or prefix breaks loading. In prose call a skill `plugin:folder`.
- **R3.** `description` is the only always-on text: verb-led, third person, about 240 chars, `Use when the user wants to <intents>` and an optional `Not for <X>`. No colon or dash, no other skill or `/command` named.
- **R4.** `argument-hint` names what the user brings: the cases they can ask for (`setup | refresh | rewire`) or the artifact the skill consumes (`request | epic`). One or two words per case, never the action slugs. Present unless no action declares an `## Input`, which means the skill takes nothing.
- **R5.** English only, one idea per sentence.

## The router

- **R6.** The router holds `## Actions` and `## Transversal rules`. Nothing else.
- **R7.** `## Actions` opens with a mermaid flow of every path a run can take: the nominal chain by slug, one entry node per case, a back-edge per loop, a terminal node per outcome, each condition as a quoted edge label. A branch stated in prose is a branch missing from the flow.
- **R8.** Below the flow, one line, `Read an action's file, then do what it says.`, then a `| Action | File |` table, one row per action file, in run order. `Action` is the bare slug, no backticks and no number; two actions sharing a slug keep their number (`01-plan`, `04-plan`). `File` links the action file.
- **R9.** `## Transversal rules` holds the rules no single action or reference owns. A rule stated there is stated nowhere else.
- **R10.** The router is loaded on every call, an action only when its turn comes: the router carries nothing an action or a reference could carry.

## An action

- **R11.** `# <NN> - <Title>`, then one sentence: what the action produces. Then `## Input` when the action consumes something, `## Process`, `## Output`, and `## Rules` when a constraint holds for the whole action. A section earns its content or is omitted, never invented or reordered.
- **R12.** A `## Process` step is one imperative sentence, numbered in run order. A case or a loop back is a dash sub-item of its step, or a step that says where to go back to. When the flow continues, the last step names the next action file.
- **R13.** `## Rules` holds what the action must or must not do throughout, one per line. A rule two actions share belongs to the router's transversal rules.

## A reference

- **R14.** References stay flat, nesting one directory deep only as a load boundary. Each stands alone, never pulling in another. It names a sibling in backticks and never links it.
- **R15.** A reference carries one fact per row: a table, a mermaid, or a list. Prose is what is left when neither fits.

## An asset

- **R16.** An asset states how it is filled and what is removed. Nothing of its scaffold survives in the artifact produced from it.

## Across all of them

- **R17.** One fact, one home. An action acts within a router rule and cites a shared reference, never restating either.
- **R18.** The first citation of a file in each authoring file is a relative Markdown link, `[name](path)`, except for sibling references under R14. Repeat mentions within the same file use only the filename in backticks when unambiguous; retain the link when ambiguous. Never an `@` include: nothing resolves those. A citation sits in the sentence that uses it, a `## Process` step to read the file, an `## Output` or `## Rules` line to conform to it. Never a block or a line of its own.
- **R19.** One file, one artifact. Split two apart only when a path needs one without the other.
- **R20.** No file names another skill or `/command`, its own plugin's included: it states the capability it needs, and the host finds a provider by description. Only an orchestrator's references name the providers they sequence.
