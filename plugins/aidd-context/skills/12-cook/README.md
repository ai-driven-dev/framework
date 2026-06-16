← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 12 - cook

Maintain the framework's `recipes/` how-to sheets. List every recipe at a glance, or create and update one scaffolded from the canonical recipe template. A maintainer/authoring tool for this repository's recipe docs.

## When to use

- List the recipes the repository ships.
- Create a new recipe, or update an existing one, from the canonical template.
- Not for generating a context artifact (skill, rule, agent, command, hook) - use the matching generator.

## Actions

| #   | Action                          | Purpose                                          |
| --- | ------------------------------- | ------------------------------------------------ |
| 01  | [list](actions/01-list.md)     | List every recipe as a title/goal/level table.   |
| 02  | [upsert](actions/02-upsert.md) | Create or update one recipe from the template.   |
