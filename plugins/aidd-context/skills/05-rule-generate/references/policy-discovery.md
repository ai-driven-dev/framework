# Policy discovery

Where to look for the policies a candidate rule may repeat or contradict.

| Source | Paths |
| --- | --- |
| Rule sources | `aidd_docs/rules/**/*.md` |
| Native rules | `.claude/rules/**/*.md`, `.cursor/rules/**/*.mdc`, `.github/instructions/**/*.instructions.md`, `.agents/rules/*.md`, `.agent/rules/*.md` |
| Instruction files | `AGENTS.md`, `AGENTS.override.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, `GEMINI.md`, `.github/copilot-instructions.md`, at the root and in folders the scope reaches |
| Configured sources | files listed in `instructions` of `opencode.json` |

- Skip the `aidd_rules` block of `AGENTS.md`: it only links rule sources already read.
- Skip a native copy identical to its source.
