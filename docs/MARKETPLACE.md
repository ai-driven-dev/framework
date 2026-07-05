# Marketplace, scopes & versioning

Reference for how the `aidd-framework` marketplace is registered, scoped, and versioned, plus the LLM tier mapping used by skills.

## How marketplaces work

A [marketplace](GLOSSARY.md#marketplace) is a Git repo that lists installable [plugins](GLOSSARY.md#plugin). Here is what happens step by step when you register one:

1. You run `/plugin marketplace add <owner>/<repo>`.
2. Claude Code clones that repo.
3. It reads the repo's `.claude-plugin/marketplace.json` file, which lists the plugins on offer.
4. Those plugins now show up when you run `/plugin install`.

This repo, `aidd-framework`, is one such marketplace. It is community-maintained and built around a specific methodology, the AI-Driven Development flow. Anthropic also runs its own [official marketplace](https://github.com/anthropics/claude-plugins-official) of broadly useful plugins. The two are not exclusive: you can register both and install plugins from either one.

Official Anthropic docs for background:

- [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins): the user-facing install flow.
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces): how to host your own.
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference): the manifest and `marketplace.json` schemas.

> **Private repo?** `/plugin marketplace add` needs read access to it. Authenticate with `gh auth login` or a personal access token (PAT). See the [install docs](https://code.claude.com/docs/en/discover-plugins).

## Install scopes

"Scope" controls where an installed plugin is remembered, and therefore who else can see it and how long it sticks around. There are three:

| Scope | Stored in | Lifetime | Best for |
| --- | --- | --- | --- |
| `user` | `~/.claude/plugins/` | Every project you open, on this machine | Your personal toolbelt |
| `project` | `enabledPlugins` in the repo's `.claude/settings.json` | Only this repo, but shared with teammates who pull it | A setup the whole team should use |
| `local` | A local directory you point to | Only this machine | Developing a plugin before publishing it |

You pick the scope when you install a plugin, either in the `/plugin` UI or by editing `enabledPlugins` in `.claude/settings.json` directly.

## Versioning & updates

- Each plugin versions independently via `release-please`. Tags look like `aidd-<plugin>-vX.Y.Z`.
- The root marketplace (`marketplace.json`) versions independently as `vX.Y.Z`.
- Pull updates inside Claude Code with `/plugin marketplace update aidd-framework`.

See [`CHANGELOG.md`](../CHANGELOG.md) for the full history.

## LLM tier reference

Some skills ask for a model **tier** instead of naming a specific model, because different steps need different amounts of reasoning. AIDD is authored against Claude, so the Claude column is the default. On another AI tool, use its closest equivalent model for each tier.

| Tier | Best for | Claude | Other tools (examples) |
| ---- | -------- | ------ | ---------------------- |
| **T1 Fast** | Mechanical, deterministic tasks, templates, git ops | Haiku 4.5 | GPT-5.5 mini, Gemini Flash, Grok fast |
| **T2 Balanced** | Implementation, validation, code generation | Sonnet 4.6 | GPT-5.5, Gemini Pro |
| **T3 Thinking** | Deep reasoning, synthesis, planning, onboarding | Opus 4.8 | GPT-5.5 (thinking), Gemini Pro thinking |
