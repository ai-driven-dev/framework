# Recipe authoring

The contract every recipe file under `recipes/` must satisfy. A recipe is a task-oriented how-to sheet: short, scannable, and reproducible.

## Location

- Recipes live in the repository's `recipes/` directory, one markdown file per recipe.
- The index lives at `recipes/README.md`. It is a table of every recipe.
- File names are kebab-case nouns describing the task: `mcp-installation.md`, not `how-to.md`.
- The `recipes/` directory may not exist yet in every branch. If it is absent, create it before writing the first recipe.

## Canonical shape

The template in `assets/recipe-template.md` is the single source of truth for the shape. Every recipe instantiates it. The shape is:

- An H1 title: the recipe name.
- A blockquote `> **Goal:**` with a one-line outcome.
- A two-column metadata table with exactly three rows: **Level**, **Time**, **Prerequisites**.
- `## Why`: one short paragraph on the problem and when to reach for the recipe.
- `## Steps`: a numbered list of imperative steps.
- `## Verify`: observable checks that prove success.
- `## Related`: links to sibling recipes, skills, or docs.

## Field rules

- **Level** is one of `Beginner`, `Intermediate`, `Advanced`. Exactly one value.
- **Time** is an estimate prefixed with `~`, e.g. `~5 min`.
- **Prerequisites** names what the reader needs first, or `None`.
- Keep prose tight. One idea per sentence. Prefer removing over adding.

## Parsing a recipe (for the `list` action)

Read each `recipes/*.md` except `README.md` and extract:

- **Title**: the first `# ` H1 line.
- **Goal**: the text after `> **Goal:**`.
- **Level**: the value in the **Level** table row.

A recipe missing any of these is malformed. Report it rather than guessing.
