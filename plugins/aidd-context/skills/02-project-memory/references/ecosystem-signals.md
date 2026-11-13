# Ecosystem signals

## What earns an entry

- Never an entry: a service the project builds, or an [AI host](tools.md).
- An entry: anything holding state or doing work outside the repo past a single CI run; a build step is not.
- A platform that is also the tracker gets one entry per role.
- The VCS platform is always an entry, so the graph is never empty.
- Evidence is service config, repo integration or a badge; the user's word fills what the repo cannot prove.
- A node's middle-dot part names the memory file holding its details.
- Rebuild the graph from the scan, not the template's example.

## Actors

`Human` is a person, `Agent` an AI assistant, `App` the running code.

## Access modes

`mcp` is an MCP server, `cli` a terminal command, `http` a direct API call, `web` a browser interface only.

## What earns an edge

- Keep `Agent` or `App` reaching a tool.
- Drop `Human` reaching a tool by `web`.
- Keep `Human` where no agent can follow, as `human only` in the label.
- Keep a hand-off between tools (CI config, webhook, or integration naming both), naming the trigger the repo proves.
- Keep a tool nobody drives, for its hand-off alone.
