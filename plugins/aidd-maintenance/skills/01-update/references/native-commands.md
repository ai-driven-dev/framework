# Native marketplace commands

Read on 2026-11-04. Commands and support can change; recheck installed help before use.

- Claude Code: `claude plugin marketplace update aidd-framework`, then `claude plugin update <plugin>@aidd-framework` for each selected installed reference and its actual scope. Updating a plugin requires a new session. [Claude Code plugin reference](https://code.claude.com/docs/en/cli-reference)
- Copilot CLI: `copilot plugin marketplace update aidd-framework`, then `copilot plugin update <plugin>@aidd-framework` for each selected installed reference. A directory-source marketplace loads its local files, not a remote release. [Copilot CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
- Codex: `codex plugin marketplace upgrade aidd-framework` refreshes a configured Git marketplace; it does not itself establish that every installed plugin changed. [Codex plugin documentation](https://developers.openai.com/plugins/build/plugins)
- Cursor, OpenCode and Kilo: an equivalent direct native release upgrade is unverified. Use their installed tool's own documented flow or report the limitation.
