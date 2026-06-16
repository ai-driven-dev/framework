---
name: 03-context-generate
description: Route a request to generate a context artifact (skill, rule, agent, command, or hook) to its dedicated generator when the user has not named which kind. For a named kind, that generator triggers directly. Not for listing existing artifacts (use discovery).
---

# Context Generate

Routes a generation request to the dedicated generator for the artifact kind. Holds no generation logic of its own.

## Routing

| Artifact | Generator                        |
| -------- | -------------------------------- |
| skill    | `aidd-context:04-skill-generate` |
| rule     | `aidd-context:05-rule-generate`  |
| agent    | `aidd-context:06-agent-generate` |
| command  | `aidd-context:07-command-generate` |
| hook     | `aidd-context:08-hook-generate`  |

Identify the artifact kind from the request, then hand off to the matching generator. If the kind is unclear, ask which one. To list or discover existing artifacts, use the discovery skill instead.
