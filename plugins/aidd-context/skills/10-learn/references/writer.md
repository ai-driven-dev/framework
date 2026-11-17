# Writer

Run `scripts/write-decision.cjs` to write a decision record from the ADR template.

```sh
node "$writer" --project "$project_root" --input "$decision_json" [--supersedes "$old_record"] [--plan]
```

- `$writer`: the absolute path of `scripts/write-decision.cjs`, next to the loaded `SKILL.md`.
- `$project_root`: the absolute path of the working directory, copied as the session reports it.
- `$decision_json`: a temporary file outside the project holding `title`, `date`, today's date as `YYYY-MM-DD`, `context`, `decision`, `alternatives` and `consequences`.
- `$old_record`: the path, from the project root, of the record this one replaces.

| Option | Effect |
| --- | --- |
| `--plan` | Writes nothing; lists each file with `create` or `update`. |
| `--supersedes` | Marks the old record Superseded and links both records to each other. |

The record is created in the project's existing decision folder, else `aidd_docs/memory/internal/decisions/`, named after the title; a name already taken is refused. The result is JSON: `operations` lists each `{path, op}`, `error` a `{code, message}`. Exit 0 means done, 1 a refusal, 2 bad usage, 3 a filesystem error; any non-zero exit comes with `error`.
