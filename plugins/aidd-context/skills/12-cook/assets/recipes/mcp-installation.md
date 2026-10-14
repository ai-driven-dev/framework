# Connect your services

Choose a CLI or MCP server so your AI assistant can work with your team's services.

<!-- Linked provider docs checked: 2026-10-14. Recommendations are this recipe's choices. -->

## Steps to connect your services

### 1) 🔎 Choose the tool

Start with the CLI when it covers your task and your assistant can run shell commands. Use MCP when you need its tools inside the assistant.

Memory links open the AIDD templates for the corresponding files in your project's `aidd_docs/memory/`.

**Version control**

| Service | Usage | CLI or MCP | Memory |
| --- | --- | --- | --- |
| GitHub | Issues, PRs, releases, CI runs | CLI: [`gh`](https://cli.github.com/manual/) | [vcs.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/vcs.md) |
| GitLab | Issues, merge requests, pipelines | CLI: [`glab`](https://docs.gitlab.com/cli/) | [vcs.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/vcs.md) |

**Ticketing**

| Service | Usage | CLI or MCP | Memory |
| --- | --- | --- | --- |
| Jira Cloud | Search, create, update tickets | CLI: [`acli`](https://developer.atlassian.com/cloud/acli/reference/commands/jira/) | [backlog.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/backlog/backlog.md) |
| Linear | Search, create, update tickets | [Linear MCP](https://linear.app/docs/mcp) | [backlog.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/backlog/backlog.md) |

**Documentation and workspace**

| Service | Usage | CLI or MCP | Memory |
| --- | --- | --- | --- |
| Confluence | Search and edit team documentation | [Atlassian MCP](https://www.atlassian.com/platform/rovo-mcp) | [ecosystem.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ecosystem/ecosystem.md) |
| Notion | Search and edit workspace pages | [Notion MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp); CLI: [`ntn`](https://developers.notion.com/cli/get-started/overview) for API scripts | [ecosystem.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ecosystem/ecosystem.md) |
| Google Workspace | Drive, Docs, Sheets, Gmail, Calendar | CLI: [`gws`](https://github.com/googleworkspace/cli), not officially supported by Google | [ecosystem.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ecosystem/ecosystem.md) |

**Browser**

| Service | Usage | CLI or MCP | Memory |
| --- | --- | --- | --- |
| Playwright | Browse and inspect a website | CLI: [`playwright-cli`](https://playwright.dev/agent-cli/installation); [`npx playwright test`](https://playwright.dev/docs/test-cli) for tests | [testing.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/testing.md) |

**Design**

| Service | Usage | CLI or MCP | Memory |
| --- | --- | --- | --- |
| Figma | Read designs to build an interface | [Figma MCP](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) | [design.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ui/design.md) |

**Monitoring**

| Service | Usage | CLI or MCP | Memory |
| --- | --- | --- | --- |
| Sentry | Inspect errors and investigate issues | CLI: [`sentry`](https://cli.sentry.dev/) | [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md) |

**Deployment**

| Service | Usage | CLI or MCP | Memory |
| --- | --- | --- | --- |
| Vercel | Deploy and read deployment logs | CLI: [`vercel`](https://vercel.com/docs/cli) | [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md) |

**Database**

| Service | Usage | CLI or MCP | Memory |
| --- | --- | --- | --- |
| Supabase | Migrations, local development, database exploration | CLI: [`supabase`](https://supabase.com/docs/reference/cli/introduction) for migrations and local development; [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp) for exploration | [database.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/database/database.md) |

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

1. Confirm the CLI or MCP is connected to the intended account and workspace.
2. Read one known item, such as a ticket, page or design.
3. Check that the result matches what you see in the service.

For GitHub, read the current repository:

```bash
gh repo view --json nameWithOwner,url
```

For Figma, ask the assistant to run [`whoami`](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/#whoami-remote-only) and check the returned account.

To disconnect later, remove the integration from your client and revoke its access in the service's account settings.
