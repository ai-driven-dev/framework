The five generated surfaces follow the current official host formats. Claude uses recursively discovered `.claude/rules/**/*.md` and a YAML `paths` list, or no frontmatter for global guidance. Rules require project settings and load on matching file operations. Cursor uses `.cursor/rules/**/*.mdc`, `description`, comma-separated `globs` and `alwaysApply`; its CLI reads the same rules. These rules cover Agent, not every Cursor product surface. [1][2]

Copilot CLI accepts `.github/instructions/**/*.instructions.md`, comma-separated `applyTo` and `**` for global instructions. It also discovers AGENTS.md. Changes take effect in a new or resumed session; multiple instruction sources can accumulate. Scoped discovery does not itself prove that a model reads the rule's complete body. [3]

Codex and OpenCode V2 discover root AGENTS.md. Their in-file scopes are model instructions, not a native glob filter. Codex selects project instruction files at startup, with AGENTS.override.md taking precedence. OpenCode V2 refreshes ambient instructions before the next request; already loaded nested guidance needs a fresh session. V2 accepts but does not resolve configuration.instructions, so publishing only modular rule files would leave their content inactive. [4][5]

One earlier claim was incorrect: global Codex guidance does not consume the project-document byte counter in the verified 0.160.1 and 0.162.1 implementations. Home/user instructions are assembled separately before the project budget is initialized. The local 32 KiB guard remains conservative; it does not measure other project documents or the configured host limit. The skill reference now reflects this distinction. [6]

Native instruction text guides model behavior; it does not guarantee compliance. The generator serializes exact patterns rather than validating five different glob grammars. Invalid patterns can match nothing; comma-bearing patterns are deliberately refused by the portable publication contract. Mixed hosts can discover both shared and native text. [1][3][4][5][7]

## Sources

[1] [Claude Code memory and rules](https://code.claude.com/docs/en/memory#organize-rules-with-clauderules), checked 2026-10-11: recursive rules, paths, activation and context rather than enforcement.

[2] [Cursor rules](https://cursor.com/docs/rules), [CLI rules](https://cursor.com/docs/cli/using#rules), and [rule applicability](https://cursor.com/help/customization/rules), checked 2026-10-11: metadata, discovery and supported product surfaces.

[3] [Copilot CLI custom instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions), checked 2026-10-11: paths, applyTo, globals, multiple sources and session refresh.

[4] [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), checked 2026-10-11: discovery, precedence, startup and project_doc_max_bytes.

[5] [OpenCode V2 instructions](https://opencode.ai/v2/docs/instructions/), checked 2026-10-11: AGENTS.md, refresh, scope and unresolved configuration.instructions.

[6] [Codex 0.162.1 implementation](https://github.com/openai/codex/blob/092d3acd6bec3e3a14bdc7e7a2810ab628ab759d/codex-rs/core/src/agents_md.rs#L63) and [0.160.1 implementation](https://github.com/openai/codex/blob/d27764b82f7118f674371e6d6e76271d9d606edb/codex-rs/core/src/agents_md.rs#L63): separate global assembly and project budget. [HTTP receipts and hashes](evidence/official/http-receipts.json).

[7] [Skill host contract](../../../../plugins/aidd-context/skills/05-rule-generate/references/rule-publication.md) and [publication script](../../../../plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs): restricted serialization, body ownership and shared publication.
