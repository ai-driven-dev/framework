# 05 - Find MCP

Enumerate connected MCP servers, summarize their capabilities, and recommend the best server for the user's external-integration intent.

## Inputs

- Free-form user intent (which external system the user wants to reach).
- MCP servers configured for the current AI tool.

## Outputs

A markdown table of connected MCP servers + a recommendation block.

```text
| Server     | Capabilities                          | Source                    |
| ---------- | ------------------------------------- | ------------------------- |
| Notion     | Search, create page, comment          | claude_ai_Notion          |
| Atlassian  | Jira/Confluence read + write          | mcp-atlassian             |
| ...        | ...                                   | ...                       |

Recommendation: <best-match server>
Why: <one sentence>
Tool prefix: <mcp__server__tool> (or invocation hint for the current AI)
```

## Process

1. **Enumerate connected MCP servers.** Read the AI tool's MCP config (`.mcp.json` for Claude Code, equivalent paths per tool; see `@${CLAUDE_PLUGIN_ROOT}/skills/06-discovery/03-context-generate/references/ai-mapping.md`).
2. **Extract metadata.** For each server, list the tools it exposes and group them by capability area.
3. **Render the table.** Columns: `Server | Capabilities | Source`. One row per server.
4. **Ask the user for intent.** `Which external system or capability do you need?` Wait for an explicit reply.
5. **Match.** Pick the single best server. If two are tied, list both.
6. **Print the recommendation block.** Server name, one-sentence rationale, tool prefix the AI uses to invoke it.
7. **Stop.** Do not call any MCP tool.

## Test

The output contains a non-empty MCP servers table matching what the AI tool actually has configured, followed by a recommendation block that names one server present in the table, a one-line rationale, and a concrete tool prefix or invocation hint.
