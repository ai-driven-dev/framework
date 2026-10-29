# FAQ

## General

| Question | Answer |
| --- | --- |
| Why AIDD instead of my own skills? | You skip the part every team rebuilds: the plan, build and review loop, the packaging, and six tools to support. |
| Does it cost money? | No, it is free (MIT). Model calls use your own plan or API balance. |
| Can I turn a plugin off without removing it? | In Claude Code, press Space on it in the **Installed** tab of `/plugin`. Elsewhere, use your tool's plugin settings. |

## Security

| Question | Answer |
| --- | --- |
| What can a plugin do? | Run commands, edit files and call services, with your permissions. |
| What should I read before installing one? | Its `README`, `hooks/hooks.json` and `.mcp.json`. |
| Which plugins run code on their own? | The ones with hooks: [list](ARCHITECTURE.md#-bundled-hooks). |
| Does AIDD send my code anywhere? | No. It is prompt content in your own tool. No server, no account. |
| How do I report a vulnerability? | Privately: [`SECURITY.md`](../SECURITY.md). Never in a public issue. |

## Measurement

| Question | Answer |
| --- | --- |
| Is anything measured? | Not until you opt in. |
| How do I turn it on? | `aidd telemetry on`, for the current clone. |
| How do I remove what it kept? | `aidd telemetry forget --yes`. |
| What does it count? | The tokens of Claude Code and Codex sessions. As shipped, it sends nothing anywhere. |

Details: [plugin README](../plugins/aidd-telemetry/README.md).

## Still stuck?

- Ask in [Discussions](https://github.com/ai-driven-dev/framework/discussions) or on [Discord](https://discord.gg/EWySJSpjWs).
- Report a bug in an [issue](https://github.com/ai-driven-dev/framework/issues/new/choose).
- More in [Support](../.github/SUPPORT.md).
