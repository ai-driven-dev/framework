# FAQ

## Why AIDD instead of my own skills?

You can write your own. AIDD gives you the part every team ends up rebuilding: a working plan, build, review loop, plugin packaging, and support for six AI tools. You write only what is specific to your project.

## Does it cost money?

No. The plugins are free (MIT). The model calls they trigger use your own plan or API balance.

## Can I turn a plugin off without removing it?

In Claude Code, yes: press Space on it in the **Installed** tab of `/plugin`. In other tools, use that tool's plugin settings.

## Security

**What can a plugin do?** Run commands, edit files and call services, through your AI tool and with your permissions. Read its `README`, `hooks/hooks.json` and `.mcp.json` before you install it.

**Which plugins run code on their own?** The ones that ship hooks: [see the list](ARCHITECTURE.md#-bundled-hooks).

**Does AIDD send my code anywhere?** No. It is prompt content that you install in your own tool. There is no AIDD server and no account.

**How do I report a vulnerability?** Privately, as described in [`SECURITY.md`](../SECURITY.md). Never in a public issue.

## Measurement

**Is anything measured?** Not until you opt in. `aidd telemetry on` turns it on for the current clone, and `aidd telemetry forget --yes` removes everything it kept. It counts the tokens of Claude Code and Codex sessions and, as shipped, sends nothing anywhere. Details: the [plugin README](../plugins/aidd-telemetry/README.md).

## Still stuck?

Ask in [Discussions](https://github.com/ai-driven-dev/framework/discussions) or on [Discord](https://discord.gg/EWySJSpjWs). For a bug, open an [issue](https://github.com/ai-driven-dev/framework/issues/new/choose). More in [Support](../.github/SUPPORT.md).
