# Frequently asked questions

Most "how do I..." answers live in the README. This page covers what isn't documented elsewhere and links to the rest.

## Install, update, other tools

- **Install / first run** → [Quick start](../README.md#-quick-start).
- **Update plugins** → [Versioning & updates](../docs/MARKETPLACE.md#versioning--updates).
- **Private repo?** Yes. `/plugin marketplace add` just needs GitHub read access (via `gh auth login` or a personal access token).
- **Cursor / Copilot / Codex / OpenCode?** This repo is built for Claude Code. For another tool, download the matching archive (`aidd-framework-<tool>-<mode>-<version>.zip`) from the latest [release](https://github.com/ai-driven-dev/framework/releases/latest), unzip it, and follow the [Other tools](../README.md#other-tools) steps.

## Cost and quotas

**Does running plugins cost money?** The plugins themselves are free (MIT license). But each time one calls Claude, that call uses your Anthropic plan or API balance, the same as any other Claude usage.

**Disable a plugin without uninstalling?** Run `/plugin` and toggle it off in the **Installed** tab. Or remove it by hand: delete its entry from `enabledPlugins` in `.claude/settings.json` (project scope), or from `~/.claude/plugins/` (user scope).

## Security

- **What can a plugin do? Is it safe?** → [Trust & safety](../README.md#-trust--safety) and [`SECURITY.md`](../SECURITY.md). A plugin can run commands, edit files, and call services through your AI tool. Before installing one, check its `actions/`, `hooks/hooks.json`, and `.mcp.json`. Claude Code still asks for your approval before each tool call by default.
- **Report a vulnerability** → [`SECURITY.md`](../SECURITY.md) (GitHub Security Advisories; never a public issue).

## Contributing

- **Write your own plugin** → [`CREATE_PLUGIN.md`](CREATE_PLUGIN.md).
- **File a bug / request a feature** → [issue templates](https://github.com/ai-driven-dev/framework/issues/new/choose).
- **Community** → [Discord](https://discord.gg/EWySJSpjWs) · [website](https://www.ai-driven-dev.fr/) (more links in the [README](../README.md#-what-is-aidd)).

## Troubleshooting

Install failures (cache, name mismatch, reload) → [Troubleshooting](TROUBLESHOOTING.md).
