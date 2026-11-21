# Writer

Run `scripts/write-rule.cjs` to write a rule source under `aidd_docs/rules/` and publish it to each host it targets.

```sh
node "$writer" --project "$project_root" --tools "$host_ids" --input "$request_json"
```

- `$writer`: the absolute path of `scripts/write-rule.cjs`, next to the loaded `SKILL.md`.
- `$project_root`: the absolute path of the working directory, copied as the session reports it.
- `$host_ids`: the confirmed IDs from `hosts.md`, comma-separated.
- `$request_json`: a temporary file outside the project holding `category`, `slug`, a one-line `description`, a `body` starting with `# <title>`, and optional `paths`, an array of globs without commas, so write `*.{ts,tsx}` as `*.ts` and `*.tsx`.

| Option | Effect |
| --- | --- |
| `--input <file>` | Add or update: writes the source, then its copies; `--tools` required. |
| `--remove <category>/<slug>` | Remove: deletes the source, its copies and its index line; exact Kilo instruction entries are removed. Other host config entries stay. |
| `--publish` | Republishes every source to its own `targets`. |
| `--tools` | Adds hosts to a source's `targets`, never removes one. |
| `--kilo-config <path>` | Select a Kilo config when more than one exists; the writer otherwise refuses ambiguity. |
| `--plan` | Writes nothing; lists each file with `create`, `update` or `delete`. |
| `--force` | Overwrites each copy the plan lists in `conflicts`; without it, the writer refuses. |

The result is JSON: `files` lists each path and its operation, `conflicts` each copy the writer did not produce, `error` a `{code, message}`. Exit 0 means done; any other exit comes with `error`.

Kilo targets reject `paths`: Kilo cannot enforce that scope. Existing JSONC comments and unrelated settings are preserved. The writer refuses ambiguous or unsafe config files and rolls back covered write failures.
