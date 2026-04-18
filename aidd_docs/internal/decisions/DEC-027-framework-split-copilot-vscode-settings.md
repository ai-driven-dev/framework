# Decision: Framework split — copilot-settings.json separate from settings.json

| Field   | Value                            |
| ------- | -------------------------------- |
| ID      | DEC-027                          |
| Date    | 2026-04-18                       |
| Feature | IDE-aware copilot settings       |
| Status  | Accepted                         |

## Context

Previously `config/.vscode/settings.json` in the framework contained both general IDE settings and copilot-critical keys (`github.copilot.enable`, `chat.agent.enabled`, etc.). This forced the CLI to hardcode `COPILOT_CRITICAL_KEYS` and a `PerKeyMergeStrategy` to differentiate ownership. Any framework update to copilot keys required a CLI code change.

## Decision

Split the framework config into two files:
- `config/.vscode/settings.json` — general VSCode IDE settings, owned by `vscode` tool, `user-prime` strategy
- `config/.vscode/copilot-settings.json` — copilot-critical keys only, owned by `copilot` tool, `framework-prime` strategy, `requiredIdeId: "vscode"`

The CLI no longer hardcodes key names. Each tool owns its file with a simple strategy. The framework carries the semantic split.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Hardcoded `PerKeyMergeStrategy` in CLI | No framework change needed | CLI must track key names across framework updates | Tight coupling, keys drift |
| Single file, vscode tool handles copilot keys | Simple | vscode tool has no business knowing copilot keys | Wrong ownership |

## Consequences

- No `PerKeyMergeStrategy` needed for vscode settings — each file uses a flat strategy
- Framework repo must maintain the split (framework change required alongside this CLI change)
- New `CONFIG_COPILOT_VSCODE_SETTINGS = "copilotVscodeSettings"` config ref in CLI
- Copilot settings are `framework-prime`: the framework enforces these values over user preferences
