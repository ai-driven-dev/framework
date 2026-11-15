# Scripts

How to run the two scripts next to the loaded `SKILL.md`, by absolute path.

## Scaffold

`scripts/scaffold-skill.cjs` writes the structure of each missing file of a new skill, and leaves every content slot to fill.

```sh
node "$scaffold" "$plan_json" "$skill_folder"
```

- `$plan_json`: a temporary file outside the project holding `name`, `description`, optional `entries` as `[{"to": slug, "label"}]`, and `actions` as `[{"slug", "title", "next": [{"to": slug} or {"end": outcome}, with an optional "label"]}]`.
- Without `entries`, the request enters the first action; every edge but one default carries a label.
- `$skill_folder`: the target folder; an existing file is kept.

It prints `created` or `kept` per file. Exit 0 written, 1 a plan it cannot draw, one reason per line, 2 usage.

## Check

`scripts/check-skill.cjs` checks the form of a skill folder against `skill-authoring.md`, without judgment.

```sh
node "$checker" "$skill_folder"
```

It prints one finding per line as `file:line rule "excerpt" => fix`. Exit 0 clean, 1 findings, 2 usage or an unreadable file.
