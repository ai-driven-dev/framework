# Ecosystem signals

What the scan learns about the services the project uses and does not build, not the [AI hosts](tools.md).

## What earns an entry

| Case | Verdict |
| --- | --- |
| It holds state, or does work, outside the repo past a single CI run | an entry; a build step is not |
| A platform that is also the tracker | one entry per role |
| The VCS platform | always an entry, so the graph is never empty |
| Evidence | service config, repo integration or a badge; the user's word fills what the repo cannot prove |
| A node's middle-dot part | names the memory file holding its details |
| The graph | rebuilt from the scan, not the template's example |

## Actors

| Actor | Is |
| --- | --- |
| `Human` | a person |
| `Agent` | an AI assistant |
| `App` | the running code |

## Access modes

| Mode | Means |
| --- | --- |
| `mcp` | an MCP server |
| `cli` | a terminal command |
| `http` | a direct API call |
| `web` | a browser interface only |

## What earns an edge

| Edge | Verdict |
| --- | --- |
| `Agent` or `App` reaching a tool | keep |
| `Human` reaching a tool by `web` | drop |
| `Human` where no agent can follow | keep as `human only` in the label |
| hand-off between tools (CI config, webhook, or integration naming both) | keep, name the trigger the repo proves |
| tool nobody drives | keep for its hand-off alone |
