# Frequently asked questions

Most "how do I…" answers live in the README; this page covers what isn't documented elsewhere and points to the rest.

## Install, update, other tools

- **Install / first run** → [Quick start](../README.md#-quick-start).
- **Update plugins** → `/plugin marketplace update aidd-framework`, or see [Versioning & updates](MARKETPLACE.md#-versioning--updates).
- **Private repo?** Yes - `/plugin marketplace add` just needs GitHub read access (via `gh auth login` or a PAT).
- **Cursor / Copilot / Codex / OpenCode?** This repo is the Claude Code distribution; each other tool installs via its own native mechanism (project files, local plugins, or a plugin command) from the [release](https://github.com/ai-driven-dev/framework/releases/latest) archives. Steps per tool → [Other tools](../README.md#other-tools).

## Cost and quotas

**Does running plugins cost money?** The plugins are MIT-licensed and free; the Claude calls they make consume your Anthropic plan or API balance (per-invocation on a plan, per-token on an API key).

**Disable a plugin without uninstalling?** Run `/plugin` and toggle it off in the **Installed** tab, or remove its entry from `.claude/settings.json` `enabledPlugins` (project scope) or `~/.claude/plugins/` (user scope).

## Security

- **What can a plugin do? Is it safe?** → [Trust and safety](../README.md#-trust-and-safety) and [`SECURITY.md`](../SECURITY.md). Plugins run commands, edit files, and call services through your AI tool - inspect a plugin's `actions/`, `hooks/hooks.json`, and `.mcp.json` before installing. Claude Code asks before tool calls by default.
- **Report a vulnerability** → [`SECURITY.md`](../SECURITY.md) (GitHub Security Advisories; never a public issue).

## Contributing

- **Write your own plugin** → [`CREATE_PLUGIN.md`](CREATE_PLUGIN.md).
- **File a bug / request a feature** → [issue templates](https://github.com/ai-driven-dev/framework/issues/new/choose).
- **Community** → [Discord](https://discord.gg/EWySJSpjWs) · [website](https://www.ai-driven-dev.fr/) (more links in the [README](../README.md#-the-ai-driven-dev)).

## Troubleshooting

Install failures (cache, name mismatch, reload) → [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
