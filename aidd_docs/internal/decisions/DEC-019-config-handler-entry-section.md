# Decision: ConfigHandler.entrySection() for per-entry tracking

| Field   | Value                      |
| ------- | -------------------------- |
| ID      | DEC-019                    |
| Date    | 2026-04-09                 |
| Feature | per-entry hash tracking    |
| Status  | Accepted                   |

## Context

Merge config files (`.mcp.json`, `.vscode/settings.json`) need per-entry hash tracking. Each tool has a different JSON structure — MCP servers live under `mcpServers`, `servers`, or `mcp` depending on the tool. Settings are top-level.

## Decision

Add `entrySection(configName): string | null` to `ConfigHandler` interface. Returns the JSON key containing trackable entries, or `null` for top-level.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Hardcoded map in use-case | Simple | Tool-specific logic in application layer | Violates hexagonal |
| New port interface | Clean separation | Over-engineered for a getter | YAGNI |

## Consequences

Each tool owns its section key mapping. Use-cases remain tool-agnostic. See DEC-016 for `mergeStrategy`.
