# Connect your services

Choose CLI, MCP or direct API access so your AI assistant can work with your team's services.

Each category points to the project memory that records how your team uses those services. This gives the assistant the right repository, workspace and conventions for its work.

## CLI, MCP or API?

Reuse an existing connection that covers your task. Choose by the operation you need:

| Option | When to use it | Advantages | Limits |
| --- | --- | --- | --- |
| CLI | Repeatable commands: inspect CI runs, manage pull requests or run migrations | Scriptable; filter output before sending it to the assistant | Requires shell access; commands may not cover your task |
| MCP | Interactive assistant work: explore a workspace, read design context or query tickets through available tools | Tools callable directly by the assistant | Requires a compatible client; tool coverage and context cost vary |
| API / SDK | A specific operation is missing from CLI and MCP, or you need custom queries and batch processing | Control requests and returned data | Requires network/runtime access; you handle authentication, pagination and errors |

Prefer CLI when it covers the task: [Playwright documents lower context use](https://playwright.dev/agent-cli/introduction#playwright-cli-vs-mcp). This is not universal: [Claude Code can load MCP tools on demand](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search).

## Steps to connect your services

### 1) 🔎 Choose the tool

For each service your project uses, choose an option that covers your task. Add another only for a need the first cannot cover.

Memory links open the AIDD templates for the corresponding files in your project's `aidd_docs/memory/`.

#### 🔀 Version control

> Work with repositories, pull requests and CI runs. Project conventions: [vcs.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/vcs.md).

| Service | CLI | MCP or native tool | API / SDK |
| --- | --- | --- | --- |
| GitHub | [`gh`](https://cli.github.com/manual/) | [GitHub MCP](https://github.com/github/github-mcp-server) | [REST API](https://docs.github.com/en/rest) |
| GitLab | [`glab`](https://docs.gitlab.com/cli/) | [GitLab MCP](https://docs.gitlab.com/user/model_context_protocol/mcp_server/) | [REST API](https://docs.gitlab.com/api/rest/) |
| Bitbucket | — | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) for search and read access | [Cloud REST API](https://developer.atlassian.com/cloud/bitbucket/rest/) |

#### 🎫 Ticketing

> Find, create and update tickets. Team workflow: [backlog.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/backlog/backlog.md).

| Service | CLI | MCP or native tool | API / SDK |
| --- | --- | --- | --- |
| GitHub Issues | [`gh issue`](https://cli.github.com/manual/gh_issue) | [GitHub MCP](https://github.com/github/github-mcp-server) | [Issues API](https://docs.github.com/en/rest/issues) |
| Jira Cloud | [`acli`](https://developer.atlassian.com/cloud/acli/reference/commands/jira/) | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) | [REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/) |
| Linear | — | [Linear MCP](https://linear.app/docs/mcp) | [GraphQL API](https://linear.app/developers/graphql) |

#### 📚 Documentation and workspace

> Access team documents, files, email and calendars. Connected tools: [ecosystem.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ecosystem/ecosystem.md).

| Service | CLI | MCP or native tool | API / SDK |
| --- | --- | --- | --- |
| Confluence | — | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) | [Cloud REST API](https://developer.atlassian.com/cloud/confluence/rest/v2/intro/) |
| Notion | [`ntn`](https://developers.notion.com/cli/get-started/overview) for API scripts | [Notion MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp) | [REST API](https://developers.notion.com/reference/intro) |
| Google Workspace | [`gws`](https://github.com/googleworkspace/cli) ⚠️ Not officially supported by Google | — | [Workspace APIs](https://developers.google.com/workspace/products) |

#### 🌐 Browser

> Open the application and check its behavior in a browser. Test instructions: [testing.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/testing.md).

| Service | CLI | MCP or native tool | API / SDK |
| --- | --- | --- | --- |
| Playwright | [`playwright-cli`](https://playwright.dev/agent-cli/installation); [`npx playwright test`](https://playwright.dev/docs/test-cli) for tests | [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) | [Library API](https://playwright.dev/docs/api/class-playwright) |
| Claude in Chrome | — | [Chrome extension](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome) | — |
| Cursor Browser | — | [Built-in browser](https://cursor.com/docs/agent/tools/browser) | — |

#### 🎨 Design

> Read designs and follow the project's design system. UI guidelines: [design.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ui/design.md).

| Service | CLI | MCP or native tool | API / SDK |
| --- | --- | --- | --- |
| Figma | — | [Figma MCP](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) | [REST API](https://developers.figma.com/docs/rest-api/) |

#### 🚨 Monitoring

> Read application errors and investigate failures. Monitoring configuration: [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md).

| Service | CLI | MCP or native tool | API / SDK |
| --- | --- | --- | --- |
| Sentry | [`sentry`](https://cli.sentry.dev/) | [Sentry MCP](https://mcp.sentry.dev/) | [Web API](https://docs.sentry.io/api/) |

#### 🚀 Deployment

> Deploy the application and inspect deployment logs. Deployment instructions: [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md).

| Service | CLI | MCP or native tool | API / SDK |
| --- | --- | --- | --- |
| Vercel | [`vercel`](https://vercel.com/docs/cli) | [Vercel MCP](https://vercel.com/docs/agent-resources/vercel-mcp) | [REST API](https://vercel.com/docs/rest-api) |

#### 🗄️ Database

> Explore the database and run migrations. Database conventions: [database.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/database/database.md).

| Service | CLI | MCP or native tool | API / SDK |
| --- | --- | --- | --- |
| PostgreSQL | [`psql`](https://www.postgresql.org/docs/current/app-psql.html) | — | [libpq client API](https://www.postgresql.org/docs/current/libpq.html) |
| MongoDB | [`mongosh`](https://www.mongodb.com/docs/mongodb-shell/) | [MongoDB MCP](https://www.mongodb.com/docs/mcp-server/) | [Drivers](https://www.mongodb.com/docs/drivers/) |
| Supabase | [`supabase`](https://supabase.com/docs/reference/cli/introduction) for migrations and local development | [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp) for exploration | [Data REST API](https://supabase.com/docs/guides/api) for database reads and writes |

Add any other services your team uses to the relevant table. `—` means no option is listed here.

### 2) 🔌 Install and sign in

1. Check existing access; in [Claude Code](https://code.claude.com/docs/en/mcp#managing-your-servers), `/mcp` shows MCP server status.
2. Follow the linked guide for your chosen CLI, MCP or API and client; install only what is missing.
3. Review the account, workspace and requested permissions, then authenticate; use read-only access when you only need reads.

These are setup examples, not required installations. Follow the guide for your service and client.

- **CLI / GitHub**: Install `gh` from its [guide](https://github.com/cli/cli#installation), then sign in and inspect the account:

  ```bash
  gh auth login
  gh auth status
  ```

- **MCP / Figma in Claude Code**: Install the recommended plugin:

  ```bash
  claude plugin install figma@claude-plugins-official
  ```

  Start a new session, run `/mcp`, select Figma, then **Authenticate**; other clients use [Figma's setup guide](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/).

- **API / GitHub**: With a token configured as described in the [REST API quickstart](https://docs.github.com/en/rest/quickstart), read the account:

  ```bash
  curl --fail --silent --show-error \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    https://api.github.com/user
  ```

Require confirmation for writes; if your client cannot enforce it, disable write tools or use provider-enforced read-only access.

### 3) ✅ Check the connection

Ask your assistant to verify project access using the [verification action](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/actions/05-verify-connection.md) and its [report table](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/connection-report.md):

- Run this prompt after recording the services and targets in project memory:

  ```text
  Verify this project's connections against aidd_docs/memory/.
  Report one row per category.
  ```
