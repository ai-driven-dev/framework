# Connect your services

Connect CLI, MCP, API or SDK access so your AI assistant can work with your team's services.

**Each category points to the project memory that records how your team uses those services.**

> This gives the assistant the right repository, workspace and conventions for its work.

Project memory records which services your team uses, and how, in `ecosystem.md`; `/aidd-context:02-project-memory` builds it.

## CLI, MCP, API or SDK?

Reuse an existing connection that covers your task. Prefer CLI when it covers the task and follows official recommendations.

| 🔌 Option | 🎯 When to use it | ✅ Advantages | ⚠️ Limits |
| --- | --- | --- | --- |
| CLI | Repeatable tasks with shell access | Scriptable; filter output; can reduce context overhead | Commands vary by version; check installed `--help`; coverage may be incomplete |
| MCP | Direct assistant interaction | Structured inputs; discoverable tools; simple invocation | Client compatibility; tool and output context cost; [server trust and permissions](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) |
| [API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api) | Operations missing from existing tools | Control requests, filters and returned data | Handle authentication, pagination, rate limits and errors |
| [SDK](https://github.com/octokit/octokit.js) | Reusable integrations in code | Language-native calls; less request boilerplate | Dependencies and version compatibility; coverage varies by library |

[Playwright documents lower CLI context use](https://playwright.dev/agent-cli/introduction#playwright-cli-vs-mcp); [Claude Code can load MCP tools on demand](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search). Speed and token cost depend on the tool and client.

## Steps to connect your services

### 1) 🔎 Choose the tool

For each service your project uses, choose an option that covers your task. Add another only for a need the first cannot cover.

What to connect, by model:

| Category | Light models | Standard models |
| --- | --- | --- |
| 🔀 Version control | x | x |
| 🎫 Ticketing | | x |
| 📚 Documentation and workspace | | x |
| 🌐 Browser | x | x |
| 🎨 Design | | x |
| 🚨 Monitoring | | x |
| 🚀 Deployment | | x |
| 🗄️ Database | x | x |

Memory links open the AIDD templates for the corresponding files in your project's `aidd_docs/memory/`.

#### 🔀 Version control

> Work with repositories, pull requests and CI runs. Project conventions: [vcs.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/vcs.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| GitHub | [`gh`](https://cli.github.com/manual/) | [GitHub MCP](https://github.com/github/github-mcp-server) |
| GitLab | [`glab`](https://docs.gitlab.com/cli/) | [GitLab MCP](https://docs.gitlab.com/user/model_context_protocol/mcp_server/) |
| Bitbucket | — | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) for search and read access |

#### 🎫 Ticketing

> Find, create and update tickets. Team workflow: [backlog.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/backlog/backlog.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| GitHub Issues | [`gh issue`](https://cli.github.com/manual/gh_issue) | [GitHub MCP](https://github.com/github/github-mcp-server) |
| Jira Cloud | [`acli`](https://developer.atlassian.com/cloud/acli/reference/commands/jira/) | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) |
| Linear | — | [Linear MCP](https://linear.app/docs/mcp) |

#### 📚 Documentation and workspace

> Access team documents, files, email and calendars. Connected tools: [ecosystem.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ecosystem/ecosystem.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Confluence | — | [Atlassian Rovo MCP](https://developer.atlassian.com/cloud/rovo-mcp/guides/getting-started/) |
| Notion | [`ntn`](https://developers.notion.com/cli/get-started/overview) for API scripts | [Notion MCP](https://developers.notion.com/guides/mcp/get-started-with-mcp) |
| Google Workspace | [`gws`](https://github.com/googleworkspace/cli) ⚠️ Not officially supported by Google | — |

#### 🌐 Browser

> Open the application and check its behavior in a browser. Test instructions: [testing.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/core/testing.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Playwright | [`playwright-cli`](https://playwright.dev/agent-cli/installation); [`npx playwright test`](https://playwright.dev/docs/test-cli) for tests | [Playwright MCP](https://playwright.dev/docs/getting-started-mcp) |
| Claude in Chrome | — | [Chrome extension](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome) |
| Cursor Browser | — | [Built-in browser](https://cursor.com/docs/agent/tools/browser) |

#### 🎨 Design

> Read designs and follow the project's design system. UI guidelines: [design.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/ui/design.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Figma | — | [Figma MCP](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) |

#### 🚨 Monitoring

> Read application errors and investigate failures. Monitoring configuration: [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Sentry | [`sentry`](https://cli.sentry.dev/) | [Sentry MCP](https://mcp.sentry.dev/) |

#### 🚀 Deployment

> Deploy the application and inspect deployment logs. Deployment instructions: [deployment.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/deployment/deployment.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| Vercel | [`vercel`](https://vercel.com/docs/cli) | [Vercel MCP](https://vercel.com/docs/agent-resources/vercel-mcp) |

#### 🗄️ Database

> Explore the database and run migrations. Database conventions: [database.md](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/02-project-memory/assets/templates/memory/database/database.md).

| Service | CLI | MCP or native tool |
| --- | --- | --- |
| PostgreSQL | [`psql`](https://www.postgresql.org/docs/current/app-psql.html) | — |
| MongoDB | [`mongosh`](https://www.mongodb.com/docs/mongodb-shell/) | [MongoDB MCP](https://www.mongodb.com/docs/mcp-server/) |
| Supabase | [`supabase`](https://supabase.com/docs/reference/cli/introduction) for migrations and local development | [Supabase MCP](https://supabase.com/docs/guides/ai-tools/mcp) for exploration |

Add any other services your team uses to the relevant table. `—` means no option is listed here.

### 2) 🔌 Install and sign in

1. Check existing access; in [Claude Code](https://code.claude.com/docs/en/mcp#managing-your-servers), `/mcp` shows MCP server status.
2. Follow the linked guide for your chosen option and client; install only what is missing.
3. Review the account, workspace and requested permissions, then authenticate; use read-only access when you only need reads.

Each client documents its own MCP setup:

| Client | MCP setup guide |
| --- | --- |
| Claude Code | [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) |
| Codex | [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) |
| Cursor | [Model Context Protocol (MCP)](https://cursor.com/docs/mcp) |
| GitHub Copilot | [Extend Copilot Chat with MCP](https://docs.github.com/en/copilot/how-tos/copilot-in-your-ide/customize-copilot/extend-copilot-with-tools-and-context/extend-copilot-chat-with-mcp) |
| OpenCode | [MCP servers](https://opencode.ai/docs/mcp-servers/) |

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

- **API / your team's internal service**: When a service has neither a CLI nor an MCP server, run `/aidd-context:04-skill-generate` starting from its API. Keep the token in an environment variable, never in the prompt, and read the account:

  ```bash
  curl --fail --silent --show-error \
    -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
    https://api.internal.example.com/v1/me
  ```

- **SDK / Stripe in application code**: Call the service through its [official client](https://github.com/stripe/stripe-node), the key read from the environment:

  ```js
  import Stripe from "stripe";

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const customers = await stripe.customers.list({ limit: 1 });
  ```

Require confirmation for writes; if your client cannot enforce it, disable write tools or use provider-enforced read-only access.

### 3) ✅ Check the connection

Record each connection in project memory: run `/aidd-context:02-project-memory refresh` and name the service when it asks what the repository cannot prove. A CLI is recorded by its command, such as `gh`, an MCP server as `mcp`, an API as `http`; an SDK is your application's access, not the assistant's.

Then run the access check. It probes each access read-only and reports what to fix:

```text
/aidd-context:13-access-check
```
