# FAQ & troubleshooting

Common questions, plus fixes for common install and load problems. Most "how do I..." answers live in the README; check there first.

## Install, update, other tools

- **Install / first run** → [Quick start](../README.md#-quick-start).
- **Update plugins** → [Versioning & updates](ARCHITECTURE.md#versioning--updates).
- **Private repo?** Yes. `/plugin marketplace add` just needs GitHub read access (via `gh auth login` or a personal access token).
- **Cursor / Copilot / Codex / OpenCode?** This repo is built for Claude Code. For another tool, download the matching archive (`aidd-framework-<tool>-<mode>-<version>.zip`) from the latest [release](https://github.com/ai-driven-dev/framework/releases/latest), unzip it, and follow the [Other tools](../README.md#other-tools) steps.

## Cost and quotas

**Does running plugins cost money?** The plugins themselves are free (MIT license). But each time one calls Claude, that call uses your Anthropic plan or API balance, the same as any other Claude usage.

**Disable a plugin without uninstalling?** Run `/plugin` and toggle it off in the **Installed** tab. Or remove it by hand: delete its entry from `enabledPlugins` in `.claude/settings.json` (project scope), or from `~/.claude/plugins/` (user scope).

## Security

- **What can a plugin do? Is it safe?** → [Trust & safety](../README.md#-trust--safety) and [`SECURITY.md`](../SECURITY.md). A plugin can run commands, edit files, and call services through your AI tool. Before installing one, check its `actions/`, `hooks/hooks.json`, and `.mcp.json`. Claude Code still asks for your approval before each tool call by default.
- **Report a vulnerability** → [`SECURITY.md`](../SECURITY.md) (GitHub Security Advisories; never a public issue).

## Common problems

- **The marketplace doesn't show my plugins after `/plugin marketplace add`.** Refresh the cache: `/plugin marketplace update aidd-framework`, then open `/plugin` → **Discover**.
- **`/plugin install` says the plugin is unknown.** The marketplace name must match the `name` field in this repo's `.claude-plugin/marketplace.json` (currently `aidd-framework`). Install with `/plugin install <plugin-name>@aidd-framework`.
- **A private repo won't add as a marketplace.** `/plugin marketplace add <owner>/<repo>` needs read access to the repo. Authenticate with `gh auth login` or a personal access token (PAT) on the machine running your AI tool.
- **My new plugin's actions don't load.** Run `/reload-plugins` in the same session, or restart the tool if a hook config changed.

## Current limitations

- **Not autonomous by default.** Skills run under human supervision. You drive each step.
- **Authored for Claude Code.** Other tools get a per-release archive built by the `aidd-cli`: download it, unzip it, install it. See [Other tools](../README.md#other-tools). Full native support for other tools is on the roadmap, not guaranteed today.
- **Plugins assume their own context.** A skill may expect a git repo, a `package.json` file, or a ticketing tool to be present. If it isn't, the skill will not work. Check the plugin's README for what it needs.
- **No hosted service.** AIDD is prompt content you install into your own tool; there is no AIDD server, account, or telemetry.

## Contributing

- **Write your own plugin** → [`CREATE_PLUGIN.md`](CREATE_PLUGIN.md).
- **File a bug / request a feature** → [issue templates](https://github.com/ai-driven-dev/framework/issues/new/choose).
- **Community** → [Discord](https://discord.gg/EWySJSpjWs) · [website](https://www.ai-driven-dev.fr/) (more links in the [README](../README.md#-what-is-aidd)).

## Still stuck?

Ask in [Discussions](https://github.com/ai-driven-dev/framework/discussions) or on [Discord](https://discord.gg/EWySJSpjWs). For a bug, open an [issue](https://github.com/ai-driven-dev/framework/issues/new/choose). See [`SUPPORT.md`](../.github/SUPPORT.md).
