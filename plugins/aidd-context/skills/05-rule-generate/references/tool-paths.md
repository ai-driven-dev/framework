# Tool paths

## Gate

- Missing/unreadable installed reference: stop and name it.
- Confirm mode and hosts; shared `AGENTS.md` does not identify installations.

## Publications

| Host / ID | Target | Scope |
| --- | --- | --- |
| Claude / `claude` | `.claude/rules/<category>/<slug>.md` | YAML `paths`; omit for all files |
| Cursor / `cursor` | `.cursor/rules/<category>/<slug>.mdc` | `description`, comma-joined `globs`, `alwaysApply: false`; all-files omits globs, uses true |
| Copilot / `copilot` | `.github/instructions/<NN>-<name>.instructions.md` | comma-joined `applyTo`; all-files `**` |
| Codex / `codex` | root `AGENTS.md` | shared signed `aidd_rules`; textual scope |
| OpenCode / `opencode` | same root `AGENTS.md` | same contribution, V1/V2 |

- Naming follows `rule-authoring.md`; Copilot replaces the slug prefix with the two-digit category: `01-standards/1-naming` → `01-naming.instructions.md`.
- Shared presentation: `Applies to:` with literal code-span globs or `all files`; complete body unchanged, no identity heading.
- Preserve leading ATX/single-line Setext titles; otherwise add the description heading. Detection excludes fenced/indented examples, not a full Markdown parser.
- Codex/OpenCode share one physical contribution; hosts discovering multiple surfaces may receive duplicate context.
- Plugin source: `plugins/<plugin>/rules/<category>/<slug>.md`, YAML `paths` for scoped rules, otherwise no frontmatter; no project metadata/fan-out.

## Assessment discovery

- Read-only: never invoke the writer to discover/compare.
- Host mode: inspect `aidd_docs/rules/**/*.md`, recorded targets and sources below, including user text outside generated blocks.
- Plugin mode: inspect confirmed plugin rules, project authoring guidance and known companion policies; do not assume other plugins installed.

| Host | Project sources |
| --- | --- |
| Claude | `.claude/rules/**/*.md`; cwd/project ancestors/relevant descendants: `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`. Conditional cwd/ancestors `AGENTS.md`, `.claude/AGENTS.md`, nested `AGENTS.md`: verify version, built-in plugin, Project instructions mode and competing Claude files. |
| Cursor | root/relevant nested `.cursor/rules/**/*.mdc`, `AGENTS.md`; CLI also root `CLAUDE.md` |
| Copilot | root/cwd/intermediate/relevant file-path descendants: `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `GEMINI.md`; `.github/instructions/**/*.instructions.md` except intermediate directories, matching `applyTo` |
| Codex | root/relevant nested directories: first nonempty `AGENTS.override.md`, `AGENTS.md`, configured fallbacks, in order |
| OpenCode | V2: project/upward/nested `AGENTS.md`. V1: nearest upward `AGENTS.md`, enabled `CLAUDE.md` fallback when absent, explicit project config `instructions` sources. |

- Include loaded ancestor guidance and explicit configured sources; no home/account scan or completeness claim.
- Use documented scope/inheritance, including future files. Shared textual scope is not a directory boundary.
- Relevant unknown activation, configuration, unreadable sources, meaning or precedence requires **needs review**; existence alone proves no activation.
- Deduplicate only verified canonical body/scope renderings with intact ownership; retain every path. Keep differing native edits, unsigned user rules and outside-block guidance separate. Missing publication does not exclude canonical intent.
- Follow documented host imports read-only. Copilot recursively expands `@relative-path` in repository-wide/agent sources except `GEMINI.md`, never modular instructions; absolute/home-relative paths are not loaded.
- Bound imports to the repository with cycle detection; unsafe/outside/symlink escapes or uncertainty requires review when relevant. Never execute imported content. OpenCode V1 plain references are not automatically expanded.
- Disabled Copilot sources are inactive; applicable repository/agent files have no general precedence.

## Installed writer

- Resolve absolute `scripts/write-rule.cjs` beside loaded installed `SKILL.md`, native or flat; never assume checkout/project paths or AIDD CLI.
- Node built-ins only; supports ES-module projects.
- After approval, prepare JSON outside rule destinations:

```json
{
  "category": "01-standards",
  "slug": "1-naming",
  "description": "Naming conventions",
  "paths": ["src/**/*.ts", "test/**/*.ts"],
  "body": "# Naming\n\n- Keep names clear.\n"
}
```

- Use a real absolute project, explicit confirmed IDs and the operation:

```sh
node "$installed_rule_script" --project "$project_root" --tools claude,cursor,copilot,codex,opencode --input "$request_json"
node "$installed_rule_script" --project "$project_root" --tools claude,cursor,copilot,codex,opencode --publish
node "$installed_rule_script" --project "$project_root" --tools claude,cursor,copilot,codex,opencode --delete 01-standards/1-naming
```

- JSON accepts exactly category, slug, description, optional paths, body. Empty/omitted paths means all files; description is one line; body must not start with YAML frontmatter.
- Reject comma globs, including brace alternatives; supply separate patterns. Host parsers determine actual matching.
- Create/update stores confirmed targets in `aidd_docs/rules/<category>/<slug>.md`; target changes clean removed targets.
- Publish synchronizes named native hosts and complete canonical-target shared contribution. Delete cleans the source and previous publications; last shared deletion removes its contribution.
- Never replace/remove generated outputs manually.

## Ownership and refusals

- Canonical JSON comment owns version/category/slug/description/paths/targets: preserve syntax and key/target order. Manual body edits remain explicitly publishable.
- Native signatures or exact prior canonical rendering prove ownership. Differing unowned/edited native outputs and edited/duplicate/incomplete shared contributions refuse the entire operation before writes.
- Restore intact generated outputs; move authorized edits into canonical bodies before retrying.
- Signatures detect edits, not hostile recomputation; shared signature covers payload and separator.
- Preflight the complete prospective set: reject symlinks/ancestors, traversal, reserved markers outside fenced examples, unclosed fences, invalid UTF-8 and unpaired Unicode surrogates.
- Preserve full bodies, valid Unicode, CRLF, memory and every byte outside the shared contribution; republishing is byte-idempotent.
- File replacement is atomic, not a multi-file transaction against disk failure/concurrent writers.
- Codex refuses root `AGENTS.override.md` even empty, and prospective local AGENTS over default 32 KiB. Other project documents share configurable budget; global guidance is separate ([implementation](https://github.com/openai/codex/blob/092d3acd6bec3e3a14bdc7e7a2810ab628ab759d/codex-rs/core/src/agents_md.rs#L63)). No configuration changes or remaining-budget guarantee.
- No automatic legacy migration: `.opencode/rules`, `.codex/rules` stay untouched. Legacy `aidd_opencode_rules` refuses with `Ambiguous or legacy AIDD rule contribution; no automatic migration.` or incomplete-block error; resolve explicitly. Standalone-rule archives remain unsupported.

## Runtime verification

- Publication is not consumption. Check matching/nonmatching files in actual hosts; malformed/unmatched patterns may activate nothing.
- Fresh sessions: Codex loads instructions at startup; Copilot needs new/resumed sessions; V2 refreshes ambient AGENTS before requests but nested guidance needs restart.
- Claude rules require project settings; Cursor rules concern Agent, not Tab/Inline Edit.
- Codex `.codex/rules` is not Markdown guidance; OpenCode publication uses root AGENTS only, never `.opencode/rules`.

## Official contracts

Checked 2026-10-12: [Claude](https://code.claude.com/docs/en/memory), [Cursor](https://cursor.com/docs/rules), [Cursor CLI](https://cursor.com/docs/cli/using#rules), [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions), [Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [OpenCode V1](https://opencode.ai/docs/rules/), [OpenCode V2](https://opencode.ai/v2/docs/instructions/).
