# Rule publication

## Publications

| Host / ID | Target | Scope |
| --- | --- | --- |
| Claude / `claude` | `.claude/rules/<category>/<slug>.md` | YAML `paths` array; omit for all files |
| Cursor / `cursor` | `.cursor/rules/<category>/<slug>.mdc` | `description`, comma-joined `globs`, `alwaysApply: false`; all-files: no globs, true |
| Copilot / `copilot` | `.github/instructions/<NN>-<name>.instructions.md` | comma-joined `applyTo`; all-files `**` |
| Codex / `codex` | root `AGENTS.md` | shared signed `aidd_rules`, textual scope |
| OpenCode / `opencode` | root `AGENTS.md` | same contribution |
| Kilo / `kilo` | `.kilo/rules/<category>/<slug>.md` plus an exact `instructions` entry in the selected `kilo.json[c]` | Markdown body; describe scope in the body when needed |

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
- Kilo: inspect all four project configurations before planning. When selection is ambiguous, pass only the user's confirmed `--kilo-config` path alongside the `kilo` target.
- Plugin: `plugins/<plugin>/rules/<category>/<slug>.md`; YAML `paths` for scope, or no frontmatter. No writer, project metadata or host fan-out.
- Physical deduplication does not ensure unique host context; local 32 KiB passes do not ensure the total instruction budget.

## Kilo configuration

Detect Kilo from `.kilo/` (including its JSON or JSONC config), root `kilo.json` or `kilo.jsonc`, or legacy `.kilocode/`. The legacy directory is a detection signal only; write new rules under `.kilo/`. Root `AGENTS.md` and OpenCode configuration alone do not identify Kilo.

Inspect `.kilo/kilo.json`, `.kilo/kilo.jsonc`, `kilo.json` and `kilo.jsonc`. `.kilo/` takes precedence over root; do not assume an ordering between JSON and JSONC at the same level. With no config, the writer creates `.kilo/kilo.jsonc`. With one config, it uses that file. With several, it reuses the unique owner of the exact rule path; otherwise present the candidates and require the user to select one with `--kilo-config`. Invalid or unsafe candidates refuse publication before writing.

The writer preserves JSONC comments, entry order, duplicates and unrelated values. Removing a rule referenced by multiple Kilo configs is refused. It rechecks config choices and destinations before publishing, stages the outputs, and restores completed replacements after covered errors. Each replacement is atomic; abrupt termination or power loss can still interrupt a multi-file publication.
