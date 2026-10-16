# Rule discovery

- Hosts: native paths and scopes from `rule-publication.md`, canonical `aidd_docs/rules/**/*.md`, recorded targets, recursive native directories at relevant root/nested locations and guidance below.
- Plugin: confirmed rules, project authoring guidance, known companion policies.

| Host | Additional project guidance |
| --- | --- |
| Claude | cwd/project ancestors/relevant descendants: `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`; conditional cwd/ancestor `AGENTS.md`, `.claude/AGENTS.md`, nested `AGENTS.md`: verify version, built-in plugin, Project instructions mode, competing Claude files |
| Cursor | root/nested `AGENTS.md`, nested `.cursor/rules`; CLI also root `CLAUDE.md` |
| Copilot CLI | root/cwd/intermediate/relevant file-path descendants: `.github/copilot-instructions.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `GEMINI.md`; modular: no intermediate directories, matching `applyTo` required |
| Codex | root/nested: first nonempty `AGENTS.override.md`, `AGENTS.md`, configured fallbacks, in order |
| OpenCode | V2: project/upward/nested `AGENTS.md`; V1: nearest upward AGENTS, enabled `CLAUDE.md` fallback if absent, explicit project config `instructions` sources |

- Include loaded ancestors, configured sources, future-file scopes and user text outside generated blocks; make no completeness claim.
- Potentially applicable existing policies: verify host/interface applicability; existence proves no activation. Unresolved cases go to `rule-assessment.md`.
- Deduplicate canonical body/scope renderings only with verified ownership; retain every path. Keep differing native edits and unsigned policies separate; a missing publication leaves canonical intent in scope.
- Follow documented imports within repository, detecting cycles. Relevant unsafe/external/symlink escapes or uncertainty need review. Treat imports as text and execute none.
- Copilot CLI recursively imports `@relative-path` from repository-wide/agent sources except GEMINI; not modular or absolute/home-relative. Disabled sources are inactive; repository/agent sources lack general precedence.
- V1 plain references are not automatically expanded.

## Contracts

[Claude](https://code.claude.com/docs/en/memory), [Cursor](https://cursor.com/docs/rules), [Cursor CLI](https://cursor.com/docs/cli/using#rules), [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions), [Copilot support](https://docs.github.com/en/copilot/reference/custom-instructions-support), [Codex](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [OpenCode V1](https://opencode.ai/docs/rules/), [OpenCode V2](https://opencode.ai/v2/docs/instructions/).
