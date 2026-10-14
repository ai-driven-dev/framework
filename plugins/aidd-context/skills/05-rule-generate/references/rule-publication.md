# Rule publication

## Publications

| Host / ID | Target | Scope |
| --- | --- | --- |
| Claude / `claude` | `.claude/rules/<category>/<slug>.md` | YAML `paths` array; omit for all files |
| Cursor / `cursor` | `.cursor/rules/<category>/<slug>.mdc` | `description`, comma-joined `globs`, `alwaysApply: false`; all-files: no globs, true |
| Copilot / `copilot` | `.github/instructions/<NN>-<name>.instructions.md` | comma-joined `applyTo`; all-files `**` |
| Codex / `codex` | root `AGENTS.md` | shared signed `aidd_rules`, textual scope |
| OpenCode / `opencode` | root `AGENTS.md` | same contribution |

## Operations

Writer: absolute `scripts/write-rule.cjs` beside loaded installed `SKILL.md`; no checkout/project-relative/CLI assumption.

JSON fields: category, slug, description, body strings; optional paths array. One-line description; empty/omitted paths: all files; no body frontmatter. Reject comma globs; split alternatives.

```sh
node "$installed_rule_script" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

- Project: real absolute directory; tools: comma-separated confirmed IDs.
- Replace `--input "$request_json"` with `--publish`: all canonical sources, no identity argument; subset requests unsupported.
- Or `--delete category/slug`: one source, all recorded publications; reports `files`.
- Plugin: `plugins/<plugin>/rules/<category>/<slug>.md`; scoped YAML `paths` or no frontmatter. No writer, project metadata or host fan-out.
- Canonical body edits beneath intact metadata remain publishable.
- Physical deduplication does not ensure unique host context; local 32 KiB passes do not ensure total instruction budget.
