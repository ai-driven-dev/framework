# FAQ

## General

| Question | Answer |
| --- | --- |
| Why AIDD instead of my own skills? | You skip what every team rebuilds: the plan, build and review loop, the packaging, and support for six tools. |
| Does it cost money? | No, it is free (MIT). Model calls use your own plan or API balance. |
| Where do I start? | `/aidd-context:00-onboard`, or pick a goal in the [guides](GUIDES.md). |
| Which plugins should I install? | The stable ones: see the [README](../README.md#plugins). |
| Which tools work? | [Compatibility](COMPATIBILITY.md). |
| How do I install, update or remove it? | [Install guide](INSTALL.md). |
| Can I turn a plugin off? | Yes, in your tool's own plugin settings. |

## Security

| Question | Answer |
| --- | --- |
| What can a plugin do? | Run commands, edit files and call services, with your permissions. |
| What should I read before installing one? | Its `README`, `hooks/hooks.json` and `.mcp.json`. |
| Which plugins run code on their own? | The ones with hooks, listed under their plugin in the [catalog](CATALOG.md). |
| Does AIDD send my code anywhere? | No. It is prompt content in your own tool. No server, no account. |
| How do I report a vulnerability? | Privately: [`SECURITY.md`](../SECURITY.md). |

## Measurement

| Question | Answer |
| --- | --- |
| Is anything measured? | Not until you opt in. |
| How do I turn it on, or erase it? | `aidd telemetry on`, then `aidd telemetry forget --yes`. |
| What does it count? | Tokens of Claude Code and Codex sessions. It sends nothing anywhere. |

Details: [plugin README](../plugins/aidd-telemetry/README.md).

## Still stuck?

[Support](../.github/SUPPORT.md)
