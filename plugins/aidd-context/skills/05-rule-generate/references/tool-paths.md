# Tool paths

## Publications

- Report unsupported hosts and alternatives; AGENTS alone identifies no installed host.

| Host / ID | Target | Scope |
| --- | --- | --- |
| Claude / `claude` | `.claude/rules/<category>/<slug>.md` | YAML `paths` array; omit for all files |
| Cursor / `cursor` | `.cursor/rules/<category>/<slug>.mdc` | `description`, comma-joined `globs`, `alwaysApply: false`; all-files: no globs, true |
| Copilot / `copilot` | `.github/instructions/<NN>-<name>.instructions.md` | comma-joined `applyTo`; all-files `**` |
| Codex / `codex` | root `AGENTS.md` | shared signed `aidd_rules`, textual scope |
| OpenCode / `opencode` | root `AGENTS.md` | same contribution |

## Discovery

- Read-only; no writer. [Native paths/scopes](#publications).
- Hosts: canonical `aidd_docs/rules/**/*.md`, recorded targets, recursive native directories at relevant root/nested locations and guidance below.
- Plugin: confirmed rules, project authoring guidance, known companion policies.

| Host | Additional project guidance |
| --- | --- |
| Claude | cwd/project ancestors/relevant descendants: `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`; conditional cwd/ancestor `AGENTS.md`, `.claude/AGENTS.md`, nested `AGENTS.md`: verify version, built-in plugin, Project instructions mode, competing Claude files |
| Cursor | root/nested `AGENTS.md`, nested `.cursor/rules`; CLI also root `CLAUDE.md` |
| Copilot CLI | root/cwd/intermediate/relevant file-path descendants: `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `GEMINI.md`; modular: no intermediate directories, matching `applyTo` required |
| Codex | root/nested: first nonempty `AGENTS.override.md`, `AGENTS.md`, configured fallbacks, in order |
| OpenCode | V2: project/upward/nested `AGENTS.md`; V1: nearest upward AGENTS, enabled `CLAUDE.md` fallback if absent, explicit project config `instructions` sources |

- Include loaded ancestors, configured sources, future-file scopes, user text outside generated blocks; no home/account scan or completeness claim.
- Potentially applicable existing policies: verify host/interface applicability; existence proves no activation. Unresolved: [Assessment](rule-authoring.md#assessment).
- Deduplicate canonical body/scope renderings only with verified ownership; retain every path. Keep differing native edits and unsigned policies separate; missing publications never exclude canonical intent.
- Follow documented imports within repository, detecting cycles. Relevant unsafe/external/symlink escapes or uncertainty need review. Never execute imports.
- Copilot CLI recursively imports `@relative-path` from repository-wide/agent sources except GEMINI; never modular or absolute/home-relative. Disabled sources are inactive; repository/agent sources lack general precedence.
- V1 plain references are not automatically expanded.

## Write

- **Plugin**: directly write/delete approved `plugins/<plugin>/rules/<category>/<slug>.md`; scoped YAML `paths` or no frontmatter. No writer/fan-out/project metadata.

### Host mode

- Resolve absolute `scripts/write-rule.cjs` beside loaded installed `SKILL.md`; no checkout/project-relative/CLI assumption.
- After approval, JSON outside destinations: category, slug, description, body strings; optional paths array. One-line description; empty/omitted paths: all files; no leading body frontmatter. Refuse comma globs; split alternatives.

```sh
node "$installed_rule_script" --project "$project_root" --tools "$confirmed_ids" --input "$request_json"
```

- Project: real absolute directory; comma-separated confirmed IDs. Replace `--input "$request_json"` with `--publish` (all canonical sources, no identity argument; confirm whole affected set or stop subset requests) or `--delete category/slug` (one source, all recorded publications).
- Never manually edit generated outputs or canonical metadata, bypass refusals or silently migrate legacy rules. Canonical body edits remain publishable.
- Physical deduplication does not ensure unique host context; local 32 KiB passes do not ensure total instruction budget.

## Validation

- Verify [Rules](rule-authoring.md#rules), [Naming](rule-authoring.md#naming), [Publications](#publications), exact approved bodies, metadata, scopes and targets.
- Check existence/deletion, shared uniqueness/cleanup, surviving user/memory bytes.
- Hosts: repeat approved publication for byte-idempotence; check actual matching/nonmatching files in fresh sessions.

## Official contracts

[Claude](https://code.claude.com/docs/en/memory), [Cursor](https://cursor.com/docs/rules), [Cursor CLI](https://cursor.com/docs/cli/using#rules), [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions), [Copilot support](https://docs.github.com/en/copilot/reference/custom-instructions-support), [Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [OpenCode V1](https://opencode.ai/docs/rules/), [OpenCode V2](https://opencode.ai/v2/docs/instructions/).
