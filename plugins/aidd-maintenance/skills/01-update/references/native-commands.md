# Native updates

The bundled `hooks/update-native.cjs` owns configuration edits and calls the host's CLI. It works without the AIDD CLI. Its supported source is the official GitHub marketplace pinned to a root release; ambiguous, managed or unsupported configurations are refused.

Run with `--tool claude|codex|copilot --scope project|user --release <tag>`. Without `--approve` it returns a JSON preview and changes no installation. Present the release, source scope, every affected installation and selected plugin versions. After the user's approval, pass the returned `approval` as `--approve`. Configuration, plugin states and target commit contribute to that value; a changed preview requires a new approval.

| Host | Plugin scope | Operation |
| --- | --- | --- |
| Claude | Current project (`local` and `project`), or separately `user` | Repoint the sole editable GitHub source, register it, then update selected plugin references at their existing scope |
| Codex | `user` | Repoint the editable Git source and upgrade the marketplace; all installed plugins from it, including disabled ones, are affected |
| Copilot CLI | `user` | Repoint the editable GitHub source, refresh the marketplace, then update installed plugin references |

The scripts preserve configuration comments and unrelated values, then verify plugin versions and enabled states. They support ordinary Codex marketplace tables and Claude/Copilot JSON or JSONC settings. Codex files containing multiline TOML strings are refused, even outside the marketplace table. Unsupported encodings, conflicting declarations, symbolic-link configurations and incomplete inventories stop before writing.

A host command can fail after the ref changes: inspect the reported partial state before a separately approved retry. Native commands do not form an atomic transaction with their settings file. The preview resolves the release commit; hosts install its tag, and their inventory does not attest the installed commit. Restart affected sessions after success.

Sources read 2026-11-12: [Codex plugins](https://learn.chatgpt.com/docs/plugins), [Codex CLI inventory source](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/cli/src/plugin_cmd.rs), [Claude marketplace commands](https://code.claude.com/docs/en/plugin-marketplaces), [Copilot CLI plugins](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference). Installed CLI help and isolated functional runs determine supported command shapes; do not extrapolate them to other hosts or source types.
