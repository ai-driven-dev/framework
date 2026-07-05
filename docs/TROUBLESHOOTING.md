# Troubleshooting

Common issues when installing or running the AIDD marketplace, plus the current limits of the framework.

## Install and load

### The marketplace doesn't show my plugins after `/plugin marketplace add`

Refresh the cache: `/plugin marketplace update aidd-framework`, then open `/plugin` → **Discover**.

### `/plugin install` says the plugin is unknown

The marketplace name must match the `name` field in this repo's `.claude-plugin/marketplace.json` (currently `aidd-framework`). Install with `/plugin install <plugin-name>@aidd-framework`.

### A private repo won't add as a marketplace

`/plugin marketplace add <owner>/<repo>` needs read access to the repo. On the machine running your AI tool, authenticate with `gh auth login` or a personal access token (PAT).

### My new plugin's actions don't load

Run `/reload-plugins` in the same session, or restart the tool if a hook config changed.

## Limitations (what AIDD does not do)

- **Not autonomous by default.** Skills run under human supervision. You drive each step.
- **Authored for Claude Code.** Other tools get a per-release archive built by the `aidd-cli`: download it, unzip it, install it. See [Other tools](../README.md#other-tools). Full native support for other tools is on the roadmap, not guaranteed today.
- **Plugins assume their own context.** A skill may expect a git repo, a `package.json` file, or a ticketing tool to be present. If it isn't, the skill will not work. Check the plugin's README for what it needs.
- **No hosted service.** AIDD is prompt content you install into your own tool; there is no AIDD server, account, or telemetry.

## Still stuck?

Ask in [Discussions](https://github.com/ai-driven-dev/framework/discussions) or on [Discord](https://discord.gg/EWySJSpjWs). For a bug, open an [issue](https://github.com/ai-driven-dev/framework/issues/new/choose). See [`SUPPORT.md`](../.github/SUPPORT.md).
