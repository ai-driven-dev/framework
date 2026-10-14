# MCP installations

Choose between a CLI and MCP by capability, then install the integration through the configuration native to your AI client.

<!-- Sources checked: 2026-08-07. -->

## Steps to install the right integration

### 1) 🔎 Choose by capability

Choose the smallest interface that fully covers the workflow, authentication model, and data scope.

1. Compare the exact operation you need against the table.

| Need | Prefer a CLI | Prefer MCP |
| --- | --- | --- |
| Scriptable commands and raw API calls | The official CLI covers the operation and its output is manageable | The client needs typed discovery or structured results |
| Live design or knowledge context | The CLI exposes the required operation and data | The server advertises the required tools, resources, or prompts |
| Authentication | The CLI's login and credential storage fit the workflow | The server's authentication, requested scopes, and host credential storage fit the workflow |
| Context cost | Output is requested only when the command runs | The client supports deferred loading such as [Claude Code Tool Search](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search) |

The last column is a decision heuristic for this recipe, not a provider guarantee.

“Official” means published by the service provider, not a guarantee of production readiness or contractual support. Statuses below were checked against the linked provider sources on 2026-10-13. “Not listed” means this recipe does not identify an official option.

| Usage | Service | MCP offered and status | CLI alternative and status | Recommended |
| --- | --- | --- | --- | --- |
| **Version control**: Manage issues, PRs, releases, and CI runs | **GitHub** | **Official**: [`api.githubcopilot.com/mcp/`](https://github.com/github/github-mcp-server) | **Official**: [`gh`](https://cli.github.com/manual/) | **CLI** |
| - | **GitLab** | **Official, experimental**: [`glab mcp serve`](https://docs.gitlab.com/cli/mcp/) | **Official**: [`glab`](https://docs.gitlab.com/cli/) | **CLI** |
| **Ticketing**: Search, create, and update tickets | **Jira** | **Official**: [`mcp.atlassian.com/v1/mcp`](https://www.atlassian.com/platform/remote-mcp-server) | **Official**: [`acli`](https://developer.atlassian.com/cloud/acli/guides/introduction/) | **CLI** |
| - | **Linear** | **Official**: [`mcp.linear.app/mcp`](https://linear.app/docs/mcp) | Not listed | **MCP** |
| **Internal Doc**: Search and maintain team documentation | **Confluence** | **Official**: [`mcp.atlassian.com/v1/mcp`](https://www.atlassian.com/platform/remote-mcp-server) | Not listed | **MCP** |
| - | **Notion** | **Official**: [`mcp.notion.com/mcp`](https://developers.notion.com/guides/mcp/get-started-with-mcp) | **Official**: [`ntn`](https://developers.notion.com/cli/get-started/overview) for API and page operations | **CLI** for scripts and API work; **MCP** for agent workflows |
| **Workspace**: Work with Drive, Docs, Sheets, Gmail, and Calendar | **Google Workspace** | Not listed | [`gws`](https://github.com/googleworkspace/cli): published under `googleworkspace`, but **not officially supported by Google** | **CLI**, if its support status meets the project's requirements |
| **Browsing**: Test user journeys and inspect browser behavior | **Playwright** | **Official**: [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp) | **Official**: [`playwright-cli`](https://playwright.dev/agent-cli/installation) for browser automation; [`npx playwright`](https://playwright.dev/docs/test-cli) for tests | **CLI** for direct browser automation and tests; **MCP** for live tool calls |
| **UI**: Read design context to implement an interface | **Figma** | **Official**: [`mcp.figma.com/mcp`](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) | **Official**: [`@figma/code-connect`](https://developers.figma.com/docs/code-connect/cli-reference/) for component mappings, not live design context | **CLI** for Code Connect mappings; **MCP** for live design context |
| **Monitoring**: Inspect errors and investigate incidents | **Sentry** | **Official**: [`mcp.sentry.dev/mcp`](https://github.com/getsentry/toolkit) | **Official**: [`sentry`](https://cli.sentry.dev/) for issue investigation; [`sentry-cli`](https://github.com/getsentry/sentry-cli) for releases and source maps | **CLI** when it covers the investigation; **MCP** for interactive debugging |
| **Deployment**: Deploy applications and inspect deployment logs | **Vercel** | **Official**: [`mcp.vercel.com`](https://vercel.com/docs/agent-resources/vercel-mcp) | **Official**: [`vercel`](https://vercel.com/docs/cli) | **CLI** for repeatable deployment workflows; **MCP** for interactive exploration |
| **Database**: Manage migrations, develop locally, and explore a project | **Supabase** | **Official**: [`mcp.supabase.com/mcp`](https://supabase.com/docs/guides/ai-tools/mcp) | **Official**: [`supabase`](https://supabase.com/docs/reference/cli/introduction) | **CLI** for migrations and local development; **MCP** for interactive exploration |

### 2) ⌨️ Install the CLI route

The agent-oriented Playwright CLI is a direct browser alternative to Playwright MCP.

1. Install `@playwright/cli` from the [official guide](https://playwright.dev/agent-cli/installation), then invoke its `playwright-cli` executable.

```bash
npm install -g @playwright/cli@latest
playwright-cli open https://example.com --headed
```

Optional rollback: `npm uninstall -g @playwright/cli`.

Use `npx playwright test` for the test runner and `npx playwright codegen` for test generation; they are different command surfaces.

### 3) 🔌 Install the MCP route

Use a provider-supported client and distinguish the recommended plugin route from manual MCP configuration.

1. Pick the [documented Figma route](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) for your client.

| Client | Figma's recommended route | Manual alternative and scope |
| --- | --- | --- |
| Claude Code | `claude plugin install figma@claude-plugins-official` | `claude mcp add --transport http --scope project figma https://mcp.figma.com/mcp` writes project configuration to `.mcp.json` under `mcpServers` |
| Codex | In the Codex app, open **Plugins**, select **+** next to Figma, then **Install Figma** | `codex mcp add figma --url https://mcp.figma.com/mcp` writes to [`~/.codex/config.toml`](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) under `mcp_servers`; trusted projects may instead use `.codex/config.toml` |
| Cursor | Run `/add-plugin figma` | Manual project configuration uses `.cursor/mcp.json` under `mcpServers` |
| GitHub Copilot in VS Code | Run **MCP: Open Workspace Folder MCP Configuration**, paste Figma's documented server object, then select **Start** | Workspace configuration uses `.vscode/mcp.json` under `servers` |

```bash
claude plugin install figma@claude-plugins-official
```

[Figma accepts only clients in its MCP catalog](https://www.figma.com/mcp-catalog/); do not extrapolate these instructions to an unlisted host.

### 4) 🔐 Restrict access

Use the server's documented authentication, expose only required capabilities, and enforce confirmation for mutations.

1. If the remote server uses OAuth, authorize it in the client and review the requested scopes; otherwise follow its documented authentication method.
2. Prefer read-only endpoints, toolsets, or allowlists when the workflow only reads.
3. Configure the host to require confirmation for mutating tools; if it cannot, disable write tools or use a provider-enforced read-only mode.

[GitHub documents](https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md#read-only-mode) this VS Code-format server-entry fragment; place it under `servers.github` in `.vscode/mcp.json`, or adapt the wrapper to the selected host:

```json
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "X-MCP-Toolsets": "repos,issues",
    "X-MCP-Readonly": "true"
  }
}
```

[Notion MCP inherits the connected user's workspace access](https://developers.notion.com/guides/mcp/mcp-security-best-practices), so review every write and any data sent to another tool.

### 5) ✅ Verify the connection

Verify the configured server, authenticated identity, exposed tools, and one read-only operation before relying on it.

1. Inspect the server through the client, then run a harmless read.

```text
Claude Code: /mcp
Codex:       codex mcp list
Cursor:      Settings > Cursor Settings > Tools & MCP
VS Code:     MCP: List Servers
```

Figma's documented successful Claude Code flow ends with:

```text
Authentication successful. Connected to figma
```

Use Figma's read-only [`whoami`](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/#whoami-remote-only) tool to confirm the authenticated email, plans, and seat type.

### 6) 🧹 Optional rollback: remove local access

Clearing authentication and local configuration stops the client from using the server.

1. Clear authentication before removing the server entry.
2. Remove the server or plugin from the client.

| Client | Clear authentication | Remove local configuration |
| --- | --- | --- |
| Claude Code | Run `/mcp`, select Figma, then **Clear authentication** | Plugin: `claude plugin uninstall figma@claude-plugins-official`; manual project server: `claude mcp remove --scope project figma` |
| Codex | Manual server: `codex mcp logout figma` | Plugin: remove Figma in the Codex app's **Plugins** panel; manual server: `codex mcp remove figma` |
| Cursor | Disconnect Figma under **Settings > Cursor Settings > Tools & MCP** | Remove the Figma plugin or its manual `.cursor/mcp.json` entry |
| GitHub Copilot in VS Code | Select the server through **MCP: List Servers** | Uninstall the server or remove its `.vscode/mcp.json` entry |

```bash
codex mcp logout figma
codex mcp remove figma
```

Removing configuration alone does not prove that the OAuth grant was revoked.

### 7) 🚫 Optional teardown: revoke provider access

Revoking the provider grant invalidates the remote OAuth authorization independently of local configuration.

1. For Figma, open [**Settings > Security > Connected apps**](https://help.figma.com/hc/en-us/articles/15021280611607-How-do-I-keep-my-account-secure).
2. Find the MCP client and select **Revoke access**.

```text
Figma > Settings > Security > Connected apps > Revoke access
```

## Verify

- The server appears in the chosen client's server list with the expected transport and scope.
- Authentication uses the intended account and workspace; for Figma, `whoami` returns that identity.
- Only the required tools are enabled; mutating calls require confirmation or are disabled.
- For optional rollback or teardown, check authentication clearing, local removal, and provider revocation separately.
