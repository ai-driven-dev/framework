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

Writer: absolute `scripts/write-rule.cjs` beside loaded installed `SKILL.md`; no checkout/project-relative/CLI assumption.

JSON: category, slug, description, body; optional paths array, omitted for all files. Split comma globs; the writer refuses what else is invalid.

```sh
node "$installed_rule_script" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

- Project: real absolute directory; tools: comma-separated confirmed IDs.
- Replace `--input "$request_json"` with `--publish`: all canonical sources, no identity argument; subset requests unsupported.
- Or `--delete category/slug`: one source, all recorded publications; reports `files`.
- Add `--plan` to any of the three: validates every refusal, writes nothing, reports `{"dryRun":true,"files":[...]}` with the exact paths a real run touches.
- Use `--check --publish` to verify: writes nothing, reports `{"drift":[...]}` and exits non-zero while any publication differs from its canonical source.
- Plugin: `plugins/<plugin>/rules/<category>/<slug>.md`; scoped YAML `paths` or no frontmatter. No writer, project metadata or host fan-out.
- Physical deduplication does not ensure unique host context; local 32 KiB passes do not ensure total instruction budget.
