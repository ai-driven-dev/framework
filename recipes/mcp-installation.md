# MCP installations

> **Goal:** Decide when to use an MCP server vs a CLI, and wire up the recommended ones.

| | |
| --- | --- |
| **Level** | Beginner |
| **Time** | ~10 min |
| **Prerequisites** | An AI assistant (Claude Code); the CLI for the service when one exists (`gh`, `acli`, …) |

## Why

> **Prefer the CLI over MCP. It is more efficient.**

An MCP server loads its full tool schema into **every** turn. That bloats the context window. A CLI call costs a few tokens and returns only what you ask for.

**Reach for MCP only when no CLI covers the service.**

⚠️ **Always verify your sources. Audit what you install before connecting any server.**

## Recommended servers

| Service | Official MCP | CLI alternative | Recommended |
| --- | --- | --- | --- |
| **GitHub** | [`api.githubcopilot.com/mcp/`](https://github.com/github/github-mcp-server) | [`gh`](https://cli.github.com/) | **CLI**: `gh` covers issues, PRs, releases, and the API at a fraction of the context |
| **Atlassian** (Jira / Confluence) | [`mcp.atlassian.com/v1/mcp`](https://www.atlassian.com/platform/remote-mcp-server) | [`acli`](https://developer.atlassian.com/cloud/acli/guides/introduction/) (Jira only at GA) | **CLI** for Jira · **MCP** for Confluence (no CLI yet) |
| **Playwright** | [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp) | [`npx playwright`](https://playwright.dev/docs/test-cli) + [official skill](https://claude.com/plugins/playwright) | **CLI**: drives a real browser (`playwright open`, `codegen`, `--headed`). The skill wraps it |
| **Figma** | [`mcp.figma.com/mcp`](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) | none for design data | **MCP** |
| **Notion** | [`mcp.notion.com/mcp`](https://developers.notion.com/guides/mcp/get-started-with-mcp) | none official | **MCP** |

## Steps

1. 🔎 **Check for a CLI first.** If the service has one (GitHub → `gh`, Jira → `acli`), install and authenticate it instead of an MCP server.
2. 🔌 **If MCP is the only option**, add the server to your `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "figma": { "url": "https://mcp.figma.com/mcp" }
     }
   }
   ```
3. 🛡️ **Audit the server** before connecting: read its docs and the permissions it requests.
4. ✅ **Restart** your assistant so it picks up the new configuration.

## Verify

- The MCP tools appear in your assistant (e.g. `/mcp` in Claude Code lists connected servers).
- For a CLI, run a read-only command (`gh auth status`, `acli jira me`) and confirm it returns.

## Related

- [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md): how the framework is structured
- [Anthropic: discover plugins](https://code.claude.com/docs/en/discover-plugins)
