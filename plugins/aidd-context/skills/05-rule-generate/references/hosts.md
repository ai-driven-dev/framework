# Hosts

How each host AI tool receives a rule, and how to detect it.

| Host / ID | Detected when | Receives | Scope |
| --- | --- | --- | --- |
| Claude Code / `claude` | `.claude/` or `CLAUDE.md` | copy `.claude/rules/<category>/<slug>.md` | YAML `paths` list; none for all files |
| Cursor / `cursor` | `.cursor/` | copy `.cursor/rules/<category>/<slug>.mdc` | `description`, comma-joined `globs`, `alwaysApply: false`; all files: `alwaysApply: true` |
| GitHub Copilot / `copilot` | `.github/copilot-instructions.md` or `.github/instructions/` | copy `.github/instructions/<NN>-<name>.instructions.md` | comma-joined `applyTo`; all files: `**` |
| Antigravity / `antigravity` | `.agents/rules/`, `.agent/rules/` or `.agents/hooks.json` | copy `.agents/rules/<slug>.md`, flat, at most 24,000 bytes | `description`; `trigger: glob` with comma-joined `globs`; all files: `trigger: always_on` |
| Codex / `codex` | `.codex/` | one line per rule in an index block of root `AGENTS.md`, linking the source | written in the line; read on demand |
| OpenCode V1 / `opencode` | `.opencode/` or `opencode.json` | the sources, through `"aidd_docs/rules/*/*.md"` in `instructions` of `opencode.json` | none: every rule loads |
| OpenCode V2 / `opencode` | same | same entry, resolved from the workspace up to the project root, loaded after `AGENTS.md` | none: every rule loads |

- Copilot `<name>` drops the slug's digit: category `01-standards`, slug `1-naming` gives `01-naming.instructions.md`.
- A lone `AGENTS.md` identifies no installed host: Cursor, Copilot, Antigravity, Codex and OpenCode all read it.
- The Codex index also loads in Cursor, Copilot and Antigravity, a known duplicate.
- OpenCode V1 falls back to `CLAUDE.md` when no `AGENTS.md` exists; V2 does not.
- `.codex/rules` holds Codex execution policy, never instructions.
- Codex's `workspace-write` sandbox blocks writes under `.agents/`.
- Unsupported host: offer a root `AGENTS.md` index, or a host above.
