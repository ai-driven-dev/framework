← [aidd-framework](../../../../README.md) / [aidd-dev](../../README.md)

# 10 - todo

Split one prompt into independent todos, run one implementer agent per
todo in parallel (each refines its todo before coding), and report a
minimal table: category, what was launched, output.

## When to use

- The user says "todo" or `/todo`.
- A single prompt bundles several independent tasks that can be
  implemented in parallel.

## Actions

| #   | Action                            | Purpose                                       |
| --- | --------------------------------- | --------------------------------------------- |
| 01  | [todo](actions/01-todo.md)        | Categorize, launch parallel agents, report.   |
