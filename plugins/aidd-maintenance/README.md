# aidd-maintenance

Release notices and updates for an AI-Driven Development installation.

The startup hook reports the registered marketplace version and the latest release, cached for 24 hours with its verification time. For a local source, the official release is an indicative reference: the local content may differ even when versions match. A marketplace version does not establish the versions of every installed plugin.

Use the update skill to inspect project and global installations, choose a release, and update supported targets.

## Compatibility

| Tool | AIDD native marketplace | Startup evidence |
| --- | --- | --- |
| Claude Code 2.1.318 | Yes | Message shown at startup |
| Codex 0.167.2 | Yes | Message shown after the first prompt; not in `exec --json` |
| Cursor Agent | Yes | Display unverified: test account reached its usage limit |
| GitHub Copilot CLI | Yes | Message shown in TUI; the binary reports 1.0.98 and the interface 1.0.105 |
| OpenCode 2.2.5 | No | Toast at TUI launch and resume; `aidd run` also shows a headless notice |
| Kilo Code 7.8.18 | No | Toast at TUI launch and resume; `aidd run` also shows a headless notice |

After inventory and confirmation, the skill can update CLI-managed project installations and global OpenCode/Kilo installations pinned to an official release. Project updates install the content prepared for review without fetching or building it again after confirmation. Cursor's CLI-managed installation is user-scoped: changing its pinned source is not yet supported.

For direct Claude, Codex and Copilot installations, bundled scripts inspect the native inventory, preview an official release, then run the host's update commands after approval. They verify installed plugin versions and preserve activation states. A changed source, inventory or target invalidates approval. Unsupported configurations stop before writing; a failed host command reports partial completion. Supported scopes and configuration limits are in [native updates](skills/01-update/references/native-commands.md).

The headless launcher writes the notice to stderr and passes the arguments and stdout to the real tool. It refuses remote servers and ambiguous project/global or overridden configurations. Direct `opencode run` and `kilo run` do not show the notice.

Copilot CLI display uses its `COPILOT_CLI` subprocess environment variable; VS Code display is unverified. OpenCode V1 and V2 are plugin API generations, distinct from interactive TUI and non-interactive CLI modes. The current OpenCode plugin has no Desktop GUI entry; the documented [GUI API](https://opencode.ai/v2/docs/build/plugins/gui/) is experimental. The Kilo VS Code extension 7.4.1 backend was tested and does not run the startup notice; no documented GUI notification path was confirmed. Sources read 2026-11-05: [OpenCode plugins](https://opencode.ai/v2/docs/build/plugins), [Kilo plugins](https://kilo.ai/docs/automate/extending/plugins).

Native formats: [Codex hooks](https://developers.openai.com/codex/hooks/), [Cursor plugins](https://cursor.com/docs/reference/plugins), [Copilot plugins](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference), [hook progress](https://docs.github.com/en/copilot/reference/hooks-reference#progress-messages) and [CLI changelog](https://github.com/github/copilot-cli/blob/main/changelog.md), [OpenCode V2](https://dev.opencode.ai/v2/docs/build/plugins) (read 2026-11-05).
