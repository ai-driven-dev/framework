← [aidd-framework](../../../../README.md) / [aidd-context](../../README.md)

# 03 - Context Generate

A router. It sends a request to generate a context artifact to the dedicated generator for that kind, and holds no generation logic of its own.

## Routing

| Artifact | Generator                          |
| -------- | ---------------------------------- |
| skill    | `aidd-context:04-skill-generate`   |
| rule     | `aidd-context:05-rule-generate`    |
| agent    | `aidd-context:06-agent-generate`   |
| command  | `aidd-context:07-command-generate` |
| hook     | `aidd-context:08-hook-generate`    |

## When to use

- The user wants to generate a context artifact but has not said which kind.

## When not to use

- A named kind: the dedicated generator triggers directly.
- Listing or discovering existing artifacts: use `aidd-context:11-discovery`.
