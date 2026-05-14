# Frequently asked questions

## Install and usage

### How do I install the marketplace?

Inside any Claude Code session, run:

```
/plugin marketplace add ai-driven-dev/aidd-framework
/plugin install <plugin-name>@aidd-framework
```

See the [Quick start](../README.md#quick-start) for the canonical flow.

### Does it work on private repositories?

Yes. `/plugin marketplace add <owner>/<repo>` requires you to be authenticated against the host repo (typically via `gh auth login` or a PAT on the machine running Claude Code). The framework's marketplace clone is gated by GitHub auth; once you have read access to this repo, install works.

### Does it work on Cursor, GitHub Copilot, or OpenCode?

This repository is the Claude Code distribution of the AIDD toolset. For other AI assistants, use the cross-tool adapter [`aidd-cli`](https://github.com/ai-driven-dev/aidd-cli), which packages the same skills for Cursor, Copilot, OpenCode, and others.

### How do I update plugins?

Inside Claude Code:

```
/plugin marketplace update aidd-framework
```

Then either reinstall the plugin you care about, or use `/plugin` to manage installs interactively. See [Versioning and updates](../README.md#versioning-and-updates) for the release model.

### How do I disable a plugin without uninstalling it?

Run `/plugin` and toggle the plugin off in the **Installed** tab, or remove its entry from `.claude/settings.json`'s `enabledPlugins` (project scope) or from `~/.claude/plugins/` (user scope).

## Cost and quotas

### Does running plugins cost money?

The plugins themselves are MIT-licensed and free. The Claude calls they make consume your Anthropic plan or API balance:

- Claude Pro / Max plan: each plugin invocation counts against your plan quota.
- API key (`ANTHROPIC_API_KEY`): each call is billed per token.

Some plugins (notably the orchestrator) explicitly support routing to per-developer accounts so teams can split quotas; see the orchestrator README.

### Will plugins make API calls without my permission?

Claude Code asks for permission for tool calls by default. The exception is when a workflow runs the action with `--permission-mode bypassPermissions` (the `aidd-orchestrator` GitHub Action does this so the pipeline can complete unattended). Read the orchestrator's [`SECURITY.md`](../SECURITY.md) for the implications.

## Security

### What can a plugin do to my machine?

Plugins can execute commands, edit files in the project, and call external services through Claude's tool interface. Before installing any plugin from any marketplace, read its README and SKILL.md, inspect its `actions/`, and check what its `hooks/hooks.json` and `.mcp.json` request.

### How do I report a vulnerability?

Use [GitHub Security Advisories](https://github.com/ai-driven-dev/aidd-framework/security/advisories/new). Email fallback: `security@ai-driven-dev.fr`. See [`SECURITY.md`](../SECURITY.md).

## Contributing and customisation

### Can I write my own plugin and ship it through this marketplace?

Yes. See [`CREATE_PLUGIN.md`](CREATE_PLUGIN.md) for the step-by-step.

### Where do I file a bug?

Use the [`Bug Report`](https://github.com/ai-driven-dev/aidd-framework/issues/new/choose) issue template. For a feature request, pick `Feature Request`. Avoid filing security-sensitive details in public issues.

### Where's the community?

- Discord: [discord.gg/ai-driven-dev](https://discord.gg/ai-driven-dev)
- Website: [ai-driven-dev.fr](https://www.ai-driven-dev.fr/)
- YouTube: [@aidd_off](https://www.youtube.com/@aidd_off)
- LinkedIn: [ai-driven-dev](https://www.linkedin.com/company/ai-driven-dev)

## Troubleshooting

For common install failures (marketplace cache, name mismatch, reload), see the [Troubleshooting](../README.md#troubleshooting) section of the top-level README.
