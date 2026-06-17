# Mermaid generation rules

The Defaults, Header, Global, Naming, Links, and Styles sections apply to every diagram type. The States and Gantt sections apply only to their own type. For a type with no section here, the global rules still hold and the rest follows standard Mermaid syntax.

## Defaults

- Target Mermaid 10.8.0 or newer.
- Flow direction defaults to `LR` unless the source implies another.

## Header

- Give the diagram a title through the `---` frontmatter block.

## Global

- Keep a label on one line. A literal `\n` renders as the characters, never use it. Prefer a shorter label over a `<br>` break.
- Use descriptive names, never `A` or `B`.
- Keep naming consistent across the diagram.

## States and nodes

- Define groups, parents, and children where the source has them.
- Use fork and join (`<<fork>>`, `<<join>>`) for parallel paths, and choice (`<<choice>>`) for a condition.
- No standalone node, no empty node.

## Naming

- Node ids are unquoted alphanumeric (`MyNode`, not `"MyNode"`).
- Labels go in brackets with quotes (`MyNode["My Label"]`).
- Keep `:` out of a state id, it delimits the state's description. Use a clean id and add a description on its own line if needed.

## Links

- Declare the elements first, then the links.
- Give the link a direction.
- `A -- text --> B` for a labeled link.
- `A -.-> B` for a dashed link, for example a conditional or optional path.
- `A ==> B` for a thick link, to emphasize a path. A self-loop is `A --> A`.

## Styles

- Do not add styling unless the user asks for it.

## Gantt

- Use the tags `active`, `done`, `crit`, `milestone`. They combine.
