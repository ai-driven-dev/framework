# Official host contracts

Checked 2026-10-09 before implementation. These contracts justify adapter targets; they do not prove runtime behavior of an unexercised host release.

## Codex
[Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), supplied by the user, documents discovery once per run/session, global guidance followed by project-root-to-working-directory guidance, and one file per directory. AGENTS.override.md takes priority over AGENTS.md. The combined instruction size defaults to 32 KiB through project_doc_max_bytes. Nested guidance appears later; discovery ends at the working directory. Restart/new run refreshes discovery. This page does not document automatic Markdown imports.

[Execution rules](https://learn.chatgpt.com/docs/agent-configuration/rules) are command policies, separate from project Markdown guidance. The former `.codex/rules/*.md` generation target must not be presented as native instruction discovery.

## OpenCode V2
[Instructions](https://opencode.ai/v2/docs/instructions) documents AGENTS.md discovery and nested instruction files. Configuration instructions entries are accepted but do not resolve files, globs or URLs in V2. References to modular sources are therefore insufficient to activate their content. Rules published in AGENTS.md carry scope as model guidance, not native per-rule glob filtering. V1 remains excluded.

## Claude Code
[Memory and project rules](https://code.claude.com/docs/en/memory) documents recursive .claude/rules Markdown discovery, optional paths metadata and native path-based loading. Without paths, a rule is unconditional. CLAUDE.md supports native @ imports; that syntax is not portable to Codex/OpenCode. The current page also documents AGENTS.md support, so publishing both native rules and shared guidance can duplicate content in a mixed-host context.

## Cursor
[Rules](https://cursor.com/docs/rules) documents .cursor/rules/*.mdc with description, globs and alwaysApply. All-files rules use alwaysApply; scoped rules use globs. A plain .md file in that rules directory is not the native MDC format. Preserve the body and serialize explicit scope without substituting a broader glob. AGENTS.md is another supported surface, so cross-surface runtime deduplication is not promised.

## GitHub Copilot
[Repository instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions) documents .github/instructions/*.instructions.md with applyTo comma-separated glob patterns. All-files scope is **. Support differs by Copilot surface; on GitHub.com the documented consumers include cloud agent and code review. Native-format tests alone do not establish coverage across every Copilot interface.

## Delivery limits
The generator never changes host configuration, trust or global guidance. Its local Codex byte guard cannot account for all global/ancestor instructions or a user's configured limit. Physical deduplication in AGENTS.md does not guarantee deduplication across other instruction surfaces. No prior CLI publication or legacy modular source is silently migrated.
