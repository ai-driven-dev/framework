# Skill authoring

The contract every generated skill satisfies. `skill-generate` obeys it too.

## The skill

- **R1.** Keep one domain per skill.
  - Follow `naming.md` for its name.
- **R2.** Keep skill names loadable.
  - Keep invocation prefixes and colons out of `name`.
  - In prose, address a skill as `plugin:folder`.
- **R3.** Make the description sufficient for invocation.
  - Treat `description` as the only always-on text.
  - Use a verb-led, third-person description of about 240 characters.
  - State usage intents with `Use when the user wants to <intents>`.
  - Optionally state exclusions with `Not for <X>`.
  - Use neither colons nor dashes.
  - Do not name other skills or `/commands`.
- **R4.** Describe the user's input in `argument-hint`.
  - Name the cases the user can request or the artifact the skill consumes.
  - Use one or two words per case.
  - Never use action slugs.
  - Include the hint when any action declares an input.
- **R5.** English only.

## The router

- **R6.** Keep only the flow, action table, and transversal rules in the router.
- **R7.** Show every execution path in the Mermaid flow.
  - Include the nominal chain.
  - Give each entry case its own node.
  - Give each loop a back-edge.
  - Give each outcome a terminal node.
  - Represent every branch stated in prose.
- **R8.** Define the action table.
  - Use `| Action | Does |`.
  - List one row per action file in run order.
  - Use bare, unnumbered action slugs without backticks in `Action`.
  - Write `Does` as a lowercase imperative half-line without a final period.
  - Introduce the table with one sentence saying only what to read next.
- **R9.** Keep transversal rules in the router.
  - Include only rules that no single action or reference owns.
  - State each one only there.
- **R10.** Place content where it is loaded.
  - The router is loaded on every call.
  - An action is loaded only when its turn comes.
  - Keep content an action or reference could carry out of the router.

## An action

- **R11.** Keep action sections in contract order.
  - Use `## Input`, `## Output`, `## Process`, then `## Test`.
  - Include the input section only when the action consumes something.
  - Omit sections that earn no content.
  - Never invent or reorder sections.
- **R12.** Structure ordered process steps.
  - Open each step with `**Label.**` and one imperative sentence.
  - Number only steps that run in order.
  - Put cases, branches, loops, and constraints in dash sub-items under their owning step.
  - Preserve emitted content in fenced blocks as its consumer requires.
- **R13.** Validate observable behavior.
  - Use a `| Case | Pass |` table for action tests.
  - Make every row observable through real execution.
  - Never use mocks.

## A reference

- **R14.** Keep references self-contained.
  - Keep their directory structure flat.
    - Nest one directory deep only as a load boundary.
  - Never make a reference pull in another.
  - Name sibling references in backticks instead of links.
- **R15.** Present reference facts in a table, Mermaid diagram, or list.
  - Give each row one fact.
  - Use prose only when none fits.

## An asset

- **R16.** Specify asset use.
  - State how to fill them.
  - State what to remove.
  - Leave none of their scaffold in the produced artifact.

## Across all of them

- **R17.** One fact, one home.
  - Before adding or changing an instruction, check the whole skill for overlap or conflict.
  - Resolve overlaps and conflicts by proposing a coherent revision of the owning rule.
  - Keep actions within router rules without restating them.
  - Cite shared references without restating their content.
- **R18.** Make citations resolvable.
  - Link the first citation of a file in each authoring file using relative Markdown, `[name](path)`.
    - Within references, follow the sibling-reference convention.
  - Use only the filename in backticks for unambiguous repeat mentions within the same file.
    - Retain the link when ambiguous.
  - Keep each citation in the sentence that reads or applies the file.
  - Never use standalone citation lines or blocks.
  - Never use `@` includes.
  - Identify content to read or edit by its purpose.
    - Do not depend on line numbers, exact headings, or quoted anchors.
    - Keep exact names when required by the artifact's format.
- **R19.** Keep one artifact per file.
  - Split artifacts only when a path needs one without the other.
- **R20.** Write for scanning.
  - Keep sentences short, with one idea each.
  - Keep each list item focused on one idea.
  - Put related conditions, exceptions, and constraints in sub-items.
