# Writer

Run `scripts/write-decision.cjs` to write a decision record from the ADR template.

```sh
node "$writer" --project "$project_root" --input "$decision_json" [--supersedes "$old_record"]
```

- `$writer`: the absolute path of `scripts/write-decision.cjs`, next to the loaded `SKILL.md`.
- `$project_root`: the absolute path of the working directory, copied as the session reports it.
- `$decision_json`: a temporary file outside the project holding `title`, `date`, today's date as `YYYY-MM-DD`, `context`, `decision`, `alternatives` and `consequences`.
- `$old_record`: the path, from the project root, of the record this one replaces.

| Option | Effect |
| --- | --- |
| `--supersedes` | Marks the old record Superseded and links both records to each other. |

- Folder: the project's existing decision folder, else `aidd_docs/memory/internal/decisions/`.
- Name: the title; a name already taken is refused.
- Result: JSON, `operations` listing each `{path, op}`, or `error` holding `{code, message}`.

| Exit | Meaning |
| --- | --- |
| 0 | Done |
| 1 | Refused |
| 2 | Bad usage |
| 3 | Filesystem error |
