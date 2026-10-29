# FAQ

Answers that no other page gives. Install steps are in the [install guide](INSTALL.md).

## Why AIDD instead of your own skills?

You can write your own skills. AIDD exists because every team that does so builds and debugs the same scaffolding alone:

- the split between a router and its actions (see [Concepts](CONCEPTS.md#building-blocks));
- the plan, implement, review gating;
- plugin packaging and versioning;
- support for several tools: Claude Code, Cursor, GitHub Copilot, Codex, OpenCode, Kilo Code.

AIDD ships that scaffolding built and maintained, so you start from a working loop and write only what is specific to your project. If your workflow does not fit its shape, you can still reuse the plugin structure described in the [architecture](ARCHITECTURE.md#-anatomy-of-a-plugin).

## Cost

- **Do the plugins cost money?** No, they are MIT-licensed. The model calls they trigger use your own plan or API balance.
- **Can I turn a plugin off without uninstalling it?** In Claude Code, yes: press Space on it in the **Installed** tab of `/plugin`. For other tools, use that tool's own plugin settings.

## Security

- **What can a plugin do?** Run commands, edit files and call services, through your AI tool and with your permissions. Before you install one, read its `README`, its `hooks/hooks.json` and its `.mcp.json`. Claude Code asks the first time it uses each tool, except for read-only actions inside the working directory.
- **Which plugins run code on their own?** Two ship hooks: the [list](ARCHITECTURE.md#-bundled-hooks).
- **How do I report a vulnerability?** Privately, as described in [`SECURITY.md`](../SECURITY.md). Never in a public issue.

## Measurement

**Nothing is measured until you opt in.** `aidd telemetry on` turns it on for the current clone, and `aidd telemetry forget --yes` removes everything it kept. It counts the tokens of Claude Code and Codex sessions and, as shipped, sends nothing anywhere. What it asks, what it keeps and what it needs are in the plugin's [README](../plugins/aidd-telemetry/README.md).

## Limits

- **Some flows pause for you, others do not.** The feature flow runs on its own by default. Start your request with `interactive` to approve its contract, plan and outcome.
- **Skills are written in Claude Code format.** The CLI and the release archives translate them for the other tools. What each tool receives is in [Compatibility](COMPATIBILITY.md).
- **Skills expect their context.** A skill that needs a git repository, a `package.json` or a ticketing tool does not work without it. Check the plugin's README.
- **There is no AIDD service today.** AIDD is prompt content you install into your own tool. There is no server and no account.

## Still stuck?

Ask in [Discussions](https://github.com/ai-driven-dev/framework/discussions) or on [Discord](https://discord.gg/EWySJSpjWs). For a bug, open an [issue](https://github.com/ai-driven-dev/framework/issues/new/choose). More in [`SUPPORT.md`](../.github/SUPPORT.md).
