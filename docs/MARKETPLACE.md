# Marketplace, scopes & versioning

Reference for how the `aidd-framework` marketplace is registered, scoped, and versioned, plus the LLM tier mapping used by skills.

## How marketplaces work

A marketplace is a Git repo that publishes plugins. When you run `/plugin marketplace add <owner>/<repo>`, Claude Code clones the repo, reads its `.claude-plugin/marketplace.json`, and offers the listed plugins for install.

`aidd-framework` is a **community-maintained, methodology-driven complement** to Anthropic's [official marketplace](https://github.com/anthropics/claude-plugins-official). The official catalog covers broadly useful plugins curated by Anthropic; AIDD ships plugins that materialise a specific way of working (the AI-Driven Development flow). The two are designed to coexist — register both and install from either.

Official Anthropic docs:

- [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins) — the user-facing flow
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) — host your own
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference) — manifest + marketplace.json schemas

> **Private repo?** `/plugin marketplace add` needs read access (`gh auth login` or a PAT) — see the [install docs](https://code.claude.com/docs/en/discover-plugins).

## Install scopes

Plugins can be installed at three scopes:

| Scope | Stored in | Lifetime | Best for |
| --- | --- | --- | --- |
| `user` | `~/.claude/plugins/` | All your projects | Personal toolbelt |
| `project` | `.claude/settings.json` (`enabledPlugins`) in the repo | This repo only | Team-shared setup |
| `local` | A local directory | This machine | Plugin development |

Set scope at install time with the `/plugin` UI, or by editing `enabledPlugins` directly in `.claude/settings.json`.

## Versioning & updates

- Each plugin versions independently via `release-please`. Tags look like `aidd-<plugin>-vX.Y.Z`.
- The root marketplace (`marketplace.json`) versions independently as `vX.Y.Z`.
- Pull updates inside Claude Code with `/plugin marketplace update aidd-framework`.

See [`CHANGELOG.md`](../CHANGELOG.md) for the full history.

## LLM tier reference

Some skills target a model **tier** when they need a particular capability. The framework is authored against Claude; on another AI tool, map each tier to that tool's nearest model.

| Tier | Best for | Claude | Other tools (examples) |
| ---- | -------- | ------ | ---------------------- |
| **T1 Fast** | Mechanical, deterministic tasks, templates, git ops | Haiku 4.5 | GPT-5.5 mini, Gemini Flash, Grok fast |
| **T2 Balanced** | Implementation, validation, code generation | Sonnet 4.6 | GPT-5.5, Gemini Pro |
| **T3 Thinking** | Deep reasoning, synthesis, planning, onboarding | Opus 4.8 | GPT-5.5 (thinking), Gemini Pro thinking |
