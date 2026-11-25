# Compatibility

What each AI tool receives from the framework.

<!--support:start-->

| Tool | Directory | Marketplace | Flat files | Skills | Agents | MCP | Hooks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `.claude/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cursor | `.cursor/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GitHub Copilot | `.github/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OpenCode | `.opencode/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events |
| Kilo Code | `.kilo/` | ❌ | ✅ | ✅ | ✅ | ❌ | Some events |
| Codex | `.codex/` | ✅ | ✅ | ✅ | ✅ | Marketplace only | ✅ |
| Antigravity CLI | `.agents/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Kiro | `.kiro/` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |

<!--support:end-->

| Cell | Meaning |
| --- | --- |
| ✅ | Supported |
| ❌ | Not supported |
| Marketplace only | Supported when installed through the tool's marketplace, not as flat files |
| Some events | Only `SessionStart`, `Stop` and `PostToolUse` |

## Limits

- Kiro receives plugin hooks for `SessionStart` only, merged into `.kiro/hooks/aidd.json` ([hook types](https://kiro.dev/docs/hooks/types/), [hooks file](https://kiro.dev/docs/hooks/)). Every other event is dropped with a build warning, because no payload for it was captured.
- With both a home and a project install, each Kiro `SessionStart` hook runs twice, because Kiro loads both files; both runs resolve to the home copy of the script.
- A script paired across events (aidd-context's artifacts start, mark and check) runs only its `SessionStart` half under Kiro, which is harmless.
- Kiro documents no user-visible hook output field, only standard output added to the agent's context, so a hook's person-facing text is not delivered.
- Kiro's Markdown agents are documented ([configuration reference](https://kiro.dev/docs/custom-agents/configuration-reference/)) but were never run against Kiro. The captured hook runs used CLI V3 JSON agents.
