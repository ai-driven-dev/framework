# Frequently asked questions

Most "how do I…" answers live in the README; this page covers what isn't documented elsewhere and points to the rest.

## Install, update, other tools

- **Install / first run** → [Quick start](../README.md#quick-start).
- **Update plugins** → [Versioning and updates](../README.md#versioning-and-updates).
- **Private repo?** Yes - `/plugin marketplace add` just needs GitHub read access (via `gh auth login` or a PAT).
- **Cursor / Copilot / Codex / OpenCode?** This repo is the Claude Code distribution; for another tool, grab the per-release archive (`aidd-framework-<tool>-<mode>-<version>.zip`) attached to each [release](https://github.com/ai-driven-dev/aidd-framework/releases/latest), unzip, and install per the [Another AI tool?](../README.md#another-ai-tool) table.

## Cost and quotas

**Does running plugins cost money?** The plugins are MIT-licensed and free; the Claude calls they make consume your Anthropic plan or API balance (per-invocation on a plan, per-token on an API key).

**Disable a plugin without uninstalling?** Run `/plugin` and toggle it off in the **Installed** tab, or remove its entry from `.claude/settings.json` `enabledPlugins` (project scope) or `~/.claude/plugins/` (user scope).

## Security

- **What can a plugin do? Is it safe?** → [Trust and safety](../README.md#trust-and-safety) and [`SECURITY.md`](../SECURITY.md). Plugins run commands, edit files, and call services through your AI tool - inspect a plugin's `actions/`, `hooks/hooks.json`, and `.mcp.json` before installing. Claude Code asks before tool calls by default.
- **Report a vulnerability** → [`SECURITY.md`](../SECURITY.md) (GitHub Security Advisories; never a public issue).

## Contributing

- **Write your own plugin** → [`CREATE_PLUGIN.md`](CREATE_PLUGIN.md).
- **File a bug / request a feature** → [issue templates](https://github.com/ai-driven-dev/aidd-framework/issues/new/choose).
- **Community** → [Discord](https://discord.gg/ai-driven-dev) · [website](https://www.ai-driven-dev.fr/) (more links in the [README](../README.md#what-is-the-aidd-framework)).

## Troubleshooting

Install failures (cache, name mismatch, reload) → [Troubleshooting](../README.md#troubleshooting).
