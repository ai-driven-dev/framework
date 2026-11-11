# Rule publication

## Publications

| Host / ID | Target | Scope |
| --- | --- | --- |
| Claude / `claude` | `.claude/rules/<category>/<slug>.md` | YAML `paths` array; omit for all files |
| Cursor / `cursor` | `.cursor/rules/<category>/<slug>.mdc` | `description`, comma-joined `globs`, `alwaysApply: false`; all-files: no globs, true |
| Copilot / `copilot` | `.github/instructions/<NN>-<name>.instructions.md` | comma-joined `applyTo`; all-files `**` |
| Codex / `codex` | root `AGENTS.md` | shared signed `aidd_rules`, textual scope |
| OpenCode / `opencode` | root `AGENTS.md` | same contribution |
| [Antigravity](https://antigravity.google/docs/rules) / `antigravity` | `.agents/rules/<slug>.md` (flat) | `description`; scoped: `trigger: glob`, comma-joined `globs` string; all-files: `trigger: always_on`, no `globs` |
| Kilo / `kilo` | `.kilo/rules/<category>/<slug>.md` | Markdown file listed by exact relative path in `instructions` in a project Kilo config |

Copilot `<name>` drops the slug's numeric prefix: category `01-standards`, slug `1-local-names` → `01-local-names.instructions.md`.

- Antigravity's 24,000-byte limit includes expanded imports; the writer checks raw output only.
- Kilo does not support enforceable path-scoped rules; the writer refuses any Kilo publication with nonempty `paths` before mutation.

## Operations

Writer: absolute `scripts/write-rule.cjs` beside the loaded installed `SKILL.md`. Assume no checkout, project-relative or CLI path.

Request JSON: category, slug, description, body; optional paths array, omitted for all files. Split comma globs; the writer refuses anything else invalid.

```sh
node "$installed_rule_script" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

- Project: real absolute directory. Tools: comma-separated confirmed IDs.
- Kilo: optional `--kilo-config <path>` selects a user-confirmed config when multiple existing candidates are ambiguous. Without one, the writer follows unique ownership or asks for a choice; with no config it creates `.kilo/kilo.jsonc`.
- `--publish` replaces `--input`: all canonical sources, no identity argument, no subsets.
- `--delete category/slug` replaces `--input`: one source, all recorded publications; reports `files`.
- `--plan` on any of the three: runs every refusal, writes nothing, reports `{"dryRun":true,"files":[...]}` with the exact paths a real run touches.
- `--check --publish`: writes nothing, reports `{"drift":[...]}`, exits non-zero while a publication differs from its canonical source.
- Kilo config updates preserve existing text and instruction order, refuse malformed or unsafe candidates before writing, and stage the rule, source, and config together with best-effort rollback on covered write failures.
- Plugin: `plugins/<plugin>/rules/<category>/<slug>.md`; YAML `paths` for scope, or no frontmatter. No writer, project metadata or host fan-out.
- Physical deduplication does not ensure unique host context; local 32 KiB passes do not ensure the total instruction budget.
- Kilo sources: [settings](https://kilo.ai/docs/getting-started/settings), [custom rules](https://kilo.ai/docs/customize/custom-rules), and [legacy fallback](https://github.com/Kilo-Org/kilocode/blob/main/packages/opencode/src/kilocode/skills/kilo-config.md), verified 2026-09-25.
