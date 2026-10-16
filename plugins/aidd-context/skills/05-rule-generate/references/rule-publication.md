# Rule publication

## Publications

| Host / ID | Target | Scope |
| --- | --- | --- |
| Claude / `claude` | `.claude/rules/<category>/<slug>.md` | YAML `paths` array; omit for all files |
| Cursor / `cursor` | `.cursor/rules/<category>/<slug>.mdc` | `description`, comma-joined `globs`, `alwaysApply: false`; all-files: no globs, true |
| Copilot / `copilot` | `.github/instructions/<NN>-<name>.instructions.md` | comma-joined `applyTo`; all-files `**` |
| Codex / `codex` | root `AGENTS.md` | shared signed `aidd_rules`, textual scope |
| OpenCode / `opencode` | root `AGENTS.md` | same contribution |

Copilot `<name>` drops the slug's numeric prefix: category `01-standards`, slug `1-local-names` → `01-local-names.instructions.md`.

## Operations

Writer: absolute `scripts/write-rule.cjs` beside the loaded installed `SKILL.md`. Assume no checkout, project-relative or CLI path.

Request JSON: category, slug, description, body; optional paths array, omitted for all files. Split comma globs; the writer refuses anything else invalid.

```sh
node "$installed_rule_script" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

- Project: real absolute directory. Tools: comma-separated confirmed IDs.
- `--publish` replaces `--input`: all canonical sources, no identity argument, no subsets.
- `--delete category/slug` replaces `--input`: one source, all recorded publications; reports `files`.
- `--plan` on any of the three: runs every refusal, writes nothing, reports `{"dryRun":true,"files":[...]}` with the exact paths a real run touches.
- `--check --publish`: writes nothing, reports `{"drift":[...]}`, exits non-zero while a publication differs from its canonical source.
- Plugin: `plugins/<plugin>/rules/<category>/<slug>.md`; YAML `paths` for scope, or no frontmatter. No writer, project metadata or host fan-out.
- Physical deduplication does not ensure unique host context; local 32 KiB passes do not ensure the total instruction budget.
