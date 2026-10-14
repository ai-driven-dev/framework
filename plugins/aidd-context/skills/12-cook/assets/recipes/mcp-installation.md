# Connect your services

Choose a CLI, MCP server or native tool so your AI assistant can work with your team's services.

Each category points to the project memory that records how your team uses those services. This gives the assistant the right repository, workspace and conventions for its work.

<!-- Linked provider docs checked: 2026-10-14. Recommendations are this recipe's choices. -->

## Steps to connect your services

### 1) 🔎 Choose the tool

Start with the CLI when it covers your task and your assistant can run shell commands. Use MCP or a native tool when you need it inside the assistant. Choose one option per service.

Memory links open the AIDD templates for the corresponding files in your project's `aidd_docs/memory/`.

**Version control**

> Work with repositories, pull requests and CI runs. Project conventions: [vcs.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/vcs.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| GitHub | [`gh`](https://cli.github.com/manual/) | [GitHub MCP](https://github.com/github/github-mcp-server) |
| GitLab | [`glab`](https://docs.gitlab.com/cli/) | [GitLab MCP](https://docs.gitlab.com/user/model_context_protocol/mcp_server/) |
| Bitbucket | — | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) for search and read access |

**Ticketing**

> Find, create and update tickets. Team workflow: [backlog.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/backlog/backlog.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| GitHub Issues | [`gh issue`](https://cli.github.com/manual/gh_issue) | [GitHub MCP](https://github.com/github/github-mcp-server) |
| Jira Cloud | [`acli`](https://developer.atlassian.com/cloud/acli/reference/commands/jira/) | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) |
| Linear | — | [Linear MCP](https://linear.app/docs/mcp) |

**Documentation and workspace**

> Access team documents, files, email and calendars. Connected tools: [ecosystem.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ecosystem/ecosystem.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Confluence | — | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) |
| Notion | [`ntn`](https://developers.notion.com/cli/get-started/overview) for API scripts | [Notion MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp) |
| Google Workspace | [`gws`](https://github.com/googleworkspace/cli) ⚠️ Not officially supported by Google | — |

**Browser**

> Open the application and check its behavior in a browser. Test instructions: [testing.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/testing.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Playwright | [`playwright-cli`](https://playwright.dev/agent-cli/installation); [`npx playwright test`](https://playwright.dev/docs/test-cli) for tests | [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) |
| Claude in Chrome | — | [Chrome extension](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome) |
| Cursor Browser | — | [Built-in browser](https://prod.cursor.com/docs/agent/tools/browser) |

**Design**

> Read designs and follow the project's design system. UI guidelines: [design.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ui/design.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Figma | — | [Figma MCP](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) |

**Monitoring**

> Read application errors and investigate failures. Monitoring configuration: [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Sentry | [`sentry`](https://cli.sentry.dev/) | [Sentry MCP](https://github.com/getsentry/toolkit) |

**Deployment**

> Deploy the application and inspect deployment logs. Deployment instructions: [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Vercel | [`vercel`](https://vercel.com/docs/cli) | [Vercel MCP](https://vercel.com/docs/agent-resources/vercel-mcp) |

**Database**

> Explore the database and run migrations. Database conventions: [database.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/database/database.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Supabase | [`supabase`](https://supabase.com/docs/reference/cli/introduction) for migrations and local development | [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp) for exploration |

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

Ask your assistant to verify the connections declared in project memory:

```text
Verify this project's connections against aidd_docs/memory/.
Report one row per category.
```

To disconnect later, remove the integration from your client and revoke its access in the service's account settings.
