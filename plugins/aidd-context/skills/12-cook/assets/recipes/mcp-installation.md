# Connect your services

Choose a CLI, MCP server or native tool so your AI assistant can work with your team's services.

<!-- Linked provider docs checked: 2026-10-14. Recommendations are this recipe's choices. -->

## Steps to connect your services

### 1) 🔎 Choose the tool

Start with the CLI when it covers your task and your assistant can run shell commands. Use MCP or a native tool when you need it inside the assistant. Choose one option per service.

Memory links open the AIDD templates for the corresponding files in your project's `aidd_docs/memory/`.

**Version control**

| Service | Usage | CLI | MCP or native tool | Memory |
| --- | --- | --- | --- | --- |
| GitHub | Issues, PRs, releases, CI runs | [`gh`](https://cli.github.com/manual/) | [GitHub MCP](https://github.com/github/github-mcp-server) | [vcs.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/vcs.md) |
| GitLab | Issues, merge requests, pipelines | [`glab`](https://docs.gitlab.com/cli/) | [GitLab MCP](https://docs.gitlab.com/user/model_context_protocol/mcp_server/) | [vcs.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/vcs.md) |
| Bitbucket | Search and read repository context | — | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) | [vcs.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/vcs.md) |

**Ticketing**

| Service | Usage | CLI | MCP or native tool | Memory |
| --- | --- | --- | --- | --- |
| Jira Cloud | Search, create, update tickets | [`acli`](https://developer.atlassian.com/cloud/acli/reference/commands/jira/) | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) | [backlog.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/backlog/backlog.md) |
| Linear | Search, create, update tickets | — | [Linear MCP](https://linear.app/docs/mcp) | [backlog.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/backlog/backlog.md) |

**Documentation and workspace**

| Service | Usage | CLI | MCP or native tool | Memory |
| --- | --- | --- | --- | --- |
| Confluence | Search and edit team documentation | — | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) | [ecosystem.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ecosystem/ecosystem.md) |
| Notion | Search and edit workspace pages | [`ntn`](https://developers.notion.com/cli/get-started/overview) for API scripts | [Notion MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp) | [ecosystem.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ecosystem/ecosystem.md) |
| Google Workspace | Drive, Docs, Sheets, Gmail, Calendar | [`gws`](https://github.com/googleworkspace/cli), not officially supported by Google | — | [ecosystem.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ecosystem/ecosystem.md) |

**Browser**

| Service | Usage | CLI | MCP or native tool | Memory |
| --- | --- | --- | --- | --- |
| Playwright | Browse and inspect a website | [`playwright-cli`](https://playwright.dev/agent-cli/installation); [`npx playwright test`](https://playwright.dev/docs/test-cli) for tests | [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) | [testing.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/testing.md) |
| Claude in Chrome | Inspect and validate the web application | — | [Chrome extension](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome) | [testing.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/testing.md) |
| Cursor Browser | Inspect and validate the web application | — | [Built-in browser](https://prod.cursor.com/docs/agent/tools/browser) | [testing.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/testing.md) |

**Design**

| Service | Usage | CLI | MCP or native tool | Memory |
| --- | --- | --- | --- | --- |
| Figma | Read designs to build an interface | — | [Figma MCP](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) | [design.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ui/design.md) |

**Monitoring**

| Service | Usage | CLI | MCP or native tool | Memory |
| --- | --- | --- | --- | --- |
| Sentry | Inspect errors and investigate issues | [`sentry`](https://cli.sentry.dev/) | [Sentry MCP](https://github.com/getsentry/toolkit) | [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md) |

**Deployment**

| Service | Usage | CLI | MCP or native tool | Memory |
| --- | --- | --- | --- | --- |
| Vercel | Deploy and read deployment logs | [`vercel`](https://vercel.com/docs/cli) | [Vercel MCP](https://vercel.com/docs/agent-resources/vercel-mcp) | [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md) |

**Database**

| Service | Usage | CLI | MCP or native tool | Memory |
| --- | --- | --- | --- | --- |
| Supabase | Migrations, local development, database exploration | [`supabase`](https://supabase.com/docs/reference/cli/introduction) for migrations and local development | [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp) for exploration | [database.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/database/database.md) |

Add any other services your team uses to the relevant table.

### 2) 🔌 Install and sign in

1. Open your tool's documentation from the table.
2. For a CLI, follow its installation and login instructions.
3. For MCP, follow the provider's instructions for your AI client, then authenticate.
4. Check the account, workspace and requested permissions before granting access.

**CLI example: GitHub.** Install `gh` using its [installation guide](https://github.com/cli/cli#installation), then run:

```bash
gh auth login
gh auth status
```

**MCP example: Figma in Claude Code.** Figma recommends its plugin:

```bash
claude plugin install figma@claude-plugins-official
```

Start a new Claude Code session, run `/mcp`, select Figma, then **Authenticate**. For another client, use [Figma's setup guide](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/).

Use a read-only mode when you only need to read. Require confirmation for writes; if your client cannot enforce it, disable write tools or use provider-enforced read-only access.

### 3) ✅ Check the connection

Run this prompt in your assistant:

```text
Check this project's connections against the tables above and aidd_docs/memory/.
For each needed service, use one available tool, confirm the account and target,
then perform one read. For the browser, open the application and read its content.
Change nothing and expose no secrets. Include missing required connections.
Mark missing evidence as unverified.
Fill this table, one row per service:

| Service | Tool | Account / target | Read evidence | Status | Next step |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

✅ Read passed · ❌ Failed · ⚠️ Unverified · ⏭️ Not needed
```

To disconnect later, remove the integration from your client and revoke its access in the service's account settings.
