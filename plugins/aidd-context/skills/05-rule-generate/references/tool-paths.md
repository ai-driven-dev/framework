# Tool paths (rules)

This reference covers project rule generation only. Confirm hosts explicitly; a shared `AGENTS.md` does not identify installed tools.

## Native targets

| Tool | Script ID | Active surface | Scope |
| --- | --- | --- | --- |
| Claude Code | `claude` | `.claude/rules/<category>/<slug>.md` | `paths` YAML array; omitted for all files |
| Cursor | `cursor` | `.cursor/rules/<category>/<slug>.mdc` | `description`, comma-joined `globs`, `alwaysApply: false`; all files omit globs and use true |
| GitHub Copilot | `copilot` | `.github/instructions/<NN>-<name>.instructions.md` | comma-joined `applyTo`; `**` for all files |
| Codex | `codex` | root `AGENTS.md`, shared signed `aidd_rules` contribution | scopes are instructions to the model |
| OpenCode V2 | `opencode` | the same contribution in root `AGENTS.md` | scopes are instructions to the model |

Use taxonomy and `#-slug` naming in [rule-authoring.md](rule-authoring.md). Copilot drops the slug's single-digit prefix and adds the category's two-digit prefix, e.g. `01-standards/1-naming` becomes `01-naming.instructions.md`.

Codex Markdown guidance is not a `.codex/rules` execution policy. OpenCode V2 ignores config `instructions`; file links and modular `.opencode/rules` sources alone do not publish their text. This contract excludes OpenCode V1. Native syntax tests prove rendering, not runtime consumption by every host. Codex/OpenCode selected together appear once in the shared file; other hosts may also discover AGENTS.md, so physical deduplication does not guarantee model-context deduplication across surfaces.

The shared contribution shows `Applies to:` followed by literal globs in Markdown code spans, or `all files`. Category/slug identity stays in canonical metadata rather than added visible headings. A leading ATX or single-line Setext title is kept without an added title; scope precedes the unchanged body. Otherwise the description supplies a level-two heading before scope and body. This bounded title check ignores fenced examples and indented code; it does not parse all Markdown. Complete body bytes and native rendering remain unchanged.

## Installed script

Resolve `scripts/write-rule.cjs` beside the loaded installed `SKILL.md` and invoke its absolute path with Node. This applies to native plugins and flat skills. Never reconstruct a plugin path, assume a framework checkout, project-relative script path, or installed AIDD CLI. The CommonJS script uses Node built-ins only and works inside ES module projects.

Prepare a JSON request outside the project rule destinations:

```json
{
  "category": "01-standards",
  "slug": "1-naming",
  "description": "Naming conventions",
  "paths": ["src/**/*.ts", "test/**/*.ts"],
  "body": "# Naming\n\n- Keep names clear.\n"
}
```

Use an absolute real project directory and confirmed comma-separated script IDs:

```sh
node "$installed_rule_script" --project "$project_root" --tools claude,cursor,copilot,codex,opencode --input "$request_json"
node "$installed_rule_script" --project "$project_root" --tools claude,cursor,copilot,codex,opencode --publish
node "$installed_rule_script" --project "$project_root" --tools claude,cursor,copilot,codex,opencode --delete 01-standards/1-naming
```

Create/update records confirmed targets in `aidd_docs/rules/<category>/<slug>.md`. Publish synchronizes the named native hosts and the complete shared contribution from canonical targets; delete also cleans the deleted rule's previous targets. Updating targets cleans removed targets. JSON accepts exactly category, slug, description, optional paths and body. Empty/omitted paths mean all files. Reject comma-containing globs (including brace alternations) rather than serialize ambiguous native lists; supply separate globs. Description is one line. Body is preserved completely and must not begin with YAML frontmatter. Scope belongs in JSON, never an arbitrary YAML parser.

## Canonical and output ownership

Canonical sources start with one strict script-owned JSON comment recording version, category, slug, description, paths and targets. Do not edit its syntax, key order or target order by hand. A body may be edited manually beneath intact metadata, then explicitly published. Generated native files carry a content signature; prior canonical rendering equality also proves ownership for an unsigned existing output. A differing unowned file, edited native file, or edited/duplicate/incomplete shared contribution refuses the entire request before writes. Restore the intact generated output and move edits into canonical sources. Hashes detect edits; they are not an authentication boundary against someone deliberately recomputing them.

The script validates the complete prospective set before changing canonical sources or outputs. It rejects symlink targets/ancestors, traversal, reserved rule markers outside fenced examples and unclosed fences. Requests and existing files must be valid UTF-8; parsed text must roundtrip without unpaired Unicode surrogates. Valid Unicode pairs and complete bodies are preserved. The shared signature covers both payload and separator ownership; editing either refuses the request. It preserves every byte outside its shared contribution, including CRLF and `aidd_project_memory`. Repeated publication is byte-idempotent. Individual file replacement is atomic; this is not a multi-file transaction against disk failures or concurrent writers.

Root `AGENTS.override.md` blocks Codex generation because it masks AGENTS.md. The script refuses a local AGENTS.md exceeding 32 KiB when Codex is involved; global and ancestor guidance also consume Codex's default combined limit. A local pass cannot guarantee that combined budget, and the script does not change host configuration.

No migration: old `.opencode/rules` or `.codex/rules` files are neither imported nor deleted. An old `aidd_opencode_rules` block causes `Ambiguous or legacy AIDD rule contribution; no automatic migration.` or the corresponding incomplete-block error. Explicitly resolve historical guidance before retrying; do not silently erase or import it. Flat archive distribution of standalone rules remains out of scope.

## Write modes

- **Host project**: use the installed script above for explicitly confirmed hosts.
- **Plugin source**: author one canonical Markdown file under `plugins/<plugin>/rules/<category>/<slug>.md`; retain a `paths` array for scoped rules or omit frontmatter for all files. No project canonical metadata, script publication or host fan-out in this mode.

Before either mode, confirm this reference is readable; otherwise report the missing installed asset. Never choose a mode or host silently.
