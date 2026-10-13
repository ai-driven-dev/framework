# Tool paths

## Publications

- Report unsupported hosts and alternatives.

| Host / ID | Target | Scope |
| --- | --- | --- |
| Claude / `claude` | `.claude/rules/<category>/<slug>.md` | YAML `paths` array; omit for all files |
| Cursor / `cursor` | `.cursor/rules/<category>/<slug>.mdc` | `description`, comma-joined `globs`, `alwaysApply: false`; all-files omits globs, uses true |
| Copilot / `copilot` | `.github/instructions/<NN>-<name>.instructions.md` | comma-joined `applyTo`; all-files `**` |
| Codex / `codex` | root `AGENTS.md` | shared signed `aidd_rules`, textual scope |
| OpenCode / `opencode` | same root `AGENTS.md` | same contribution, V1/V2 |

- Copilot renames `01-standards/1-naming` → `01-naming.instructions.md`.

## Discovery

- Read-only; never invoke the writer for assessment.
- Native paths/scopes: [Publications](#publications).
- Host mode: canonical `aidd_docs/rules/**/*.md`, recorded targets, native directories recursively at relevant root/nested locations, and guidance below.
- Plugin mode: confirmed plugin rules, project authoring guidance and known companion policies.

| Host | Additional project guidance |
| --- | --- |
| Claude | cwd/project ancestors/relevant descendants: `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`; conditional cwd/ancestors `AGENTS.md`, `.claude/AGENTS.md`, nested `AGENTS.md`: verify version, built-in plugin, Project instructions mode and competing Claude files |
| Cursor | root/nested `AGENTS.md`, nested `.cursor/rules`; CLI also root `CLAUDE.md` |
| Copilot CLI | root/cwd/intermediate/relevant file-path descendants: `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `GEMINI.md`; modular instructions exclude intermediate directories, require matching `applyTo` |
| Codex | root/nested: first nonempty `AGENTS.override.md`, `AGENTS.md`, configured fallbacks, in order |
| OpenCode | V2: project/upward/nested `AGENTS.md`; V1: nearest upward AGENTS, enabled `CLAUDE.md` fallback when absent, explicit project config `instructions` sources |

- Include loaded ancestors, configured sources, future-file scopes and user text outside generated blocks; no home/account scan or completeness claim.
- Verify host/interface applicability; relevant unknown interface/activation/configuration, unreadable sources or precedence means **needs review**; existence proves no activation.
- Deduplicate only canonical body/scope renderings with verified ownership, retaining every path. Differing native edits and unsigned user policies remain separate; missing publications do not exclude canonical intent.
- Follow documented host imports, bounded to the repository with cycle detection; unsafe/external/symlink escapes or uncertainty requires review when relevant. Never execute imported content.
- Copilot CLI recursively imports `@relative-path` from repository-wide/agent sources except GEMINI, never modular instructions or absolute/home-relative paths. Disabled sources are inactive; repository/agent sources lack general precedence.
- V1 plain references are not automatically expanded.

## Write

- **Plugin mode**: directly write/delete approved `plugins/<plugin>/rules/<category>/<slug>.md` sources; scoped YAML `paths` or no frontmatter. No writer/fan-out/project metadata.

### Host mode

- Formats: [Publications](#publications).
- Shared AGENTS identifies no installation.
- Resolve absolute `scripts/write-rule.cjs` beside loaded installed `SKILL.md`; no checkout/project-relative/CLI assumption.
- After approval, prepare JSON outside destinations: category, slug, description, body strings; optional paths array. Description: one line. Empty/omitted paths: all files. Body: no leading YAML frontmatter. Comma globs: refuse; split alternatives.

```sh
node "$installed_rule_script" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

- Project: real absolute directory; confirmed IDs comma-separated. Replace `--input "$request_json"` with `--publish` (all canonical sources, no identity argument; confirm the whole affected source set or stop on a subset request) or `--delete category/slug` (one source and all its recorded publications).
- Never edit generated outputs or canonical metadata manually. Manual canonical body edits remain publishable.
- Writer preflights ownership and targets, cleans removed publications and preserves unrelated bytes. Never bypass refusals or silently migrate legacy rules.
- Root Codex override refuses even empty; local 32 KiB check cannot guarantee total instruction budget.
- Host parsers determine applicability; check actual matching/nonmatching files in fresh sessions. Physical deduplication does not guarantee deduplicated host context.

## Validation

- Verify [Rules](rule-authoring.md#rules), [Naming](rule-authoring.md#naming), [Publications](#publications) and exact approved bodies, metadata, scopes and targets.
- Check existence/deletion, shared uniqueness/cleanup and surviving user/memory bytes.
- Host publications: repeat approved publication to verify byte-idempotence.

## Official contracts

[Claude](https://code.claude.com/docs/en/memory), [Cursor](https://cursor.com/docs/rules), [Cursor CLI](https://cursor.com/docs/cli/using#rules), [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions), [Copilot support](https://docs.github.com/en/copilot/reference/custom-instructions-support), [Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [OpenCode V1](https://opencode.ai/docs/rules/), [OpenCode V2](https://opencode.ai/v2/docs/instructions/).
