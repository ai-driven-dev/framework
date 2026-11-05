# Ecosystem signals

What the scan learns about the services the project uses and does not build. The AI hosts the memory is wired into are `tools.md`.

## What earns an entry

- It holds state, or does work, outside the repo past a single CI run; a build step does not.
- One entry per role: a platform that is also the tracker gives two.
- The VCS platform always counts, so the graph is never empty.

## Actors

| Actor | Is |
| --- | --- |
| `Human` | a person opening the tool |
| `Agent` | an AI assistant driving it |
| `App` | the running code calling it |

## Access modes

| Mode | Means |
| --- | --- |
| `mcp` | an MCP server the agent calls |
| `cli` | a command run in a terminal |
| `http` | a direct API call |
| `web` | a browser interface, nothing programmatic |

## What earns an edge

| Edge | Verdict |
| --- | --- |
| `Agent` reaching a tool | keep, what an assistant can drive is never obvious |
| `App` reaching a tool | keep, it names a runtime dependency |
| `Human` reaching a tool by `web` | drop, a person opens anything in a browser |
| `Human` where no agent can follow | keep as `human only` in the label, so absence is not doubt |
| hand-off with its trigger | keep, the trigger is what makes it a rule |
| tool nobody drives | keep for its hand-off alone: acting on its own is the fact |
| hand-off without a trigger | keep, name the trigger the repo proves |

## Detected when

| Fact | Read as |
| --- | --- |
| service config or repo integration, whoever runs it, plus a badge | the tool exists |
| CI config, webhook, or integration naming two tools | a hand-off between them |
| the user names it | what the repo cannot prove |
