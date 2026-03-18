---
name: decision
description: Location of shared tool configuration helpers
argument-hint: N/A
---

# Decision: shared tool helpers belong in tool-config.ts, never in shared.*

| Field   | Value                       |
| ------- | --------------------------- |
| ID      | DEC-002                     |
| Date    | 2026-03-18                  |
| Feature | aidd-branding-signals       |
| Status  | Accepted                    |

## Context

Extracting common logic across `claude.ts`, `cursor.ts`, `opencode.ts`, `copilot.ts` (rewrite, frontmatter conversion, path building, section key detection) required a shared location. A `shared.ts` file was initially created in `domain/tools/`.

## Decision

Shared tool helpers live in `domain/models/tool-config.ts` alongside the `ToolConfig` interface, `SectionHandler`, `stripToolSuffix`, and `agentNameFromFrontmatter`. This file is already the canonical home for tool configuration types and utilities. No `shared.ts` or utility grab-bag files in `domain/tools/`.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| `shared.ts` in `domain/tools/` | Easy to find | Unnamed grab-bag, unclear ownership | No semantic meaning |
| Keep duplication per tool | Tools can diverge independently | ~15 clones flagged by jscpd | Unnecessary given stable interface |
| Dedicated class (e.g. `ToolConfigHelpers`) | Encapsulated | Overhead for stateless functions | Over-engineered |

## Consequences

- `tool-config.ts` is the single source for all tool configuration logic
- New helpers for tools must be added there, not in new utility files
- Tools import from `../models/tool-config.js` only
