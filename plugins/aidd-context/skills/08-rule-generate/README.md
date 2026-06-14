← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 08 - rule-generate

Write one canonical coding rule from intent and render it once per host AI tool that supports rules. A sibling of `07-skill-generate` for the rule artifact.

## When to use

- The user wants to write, add, or refactor a rule, a convention, or a coding standard.
- Scan a codebase and propose rules.
- Not for other artifacts (skills, agents, commands, hooks).

## Actions

| #   | Action                                    | Purpose                                      |
| --- | ----------------------------------------- | -------------------------------------------- |
| 01  | [capture-rule](actions/01-capture-rule.md) | Capture the topic, pick category and slug.  |
| 02  | [write-rule](actions/02-write-rule.md)     | Write the rule file per supported tool.     |
| 03  | [validate](actions/03-validate.md)         | Check each rule file.                        |
