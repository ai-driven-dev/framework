# Decision: excludedMcp per-tool in manifest

| Field   | Value                            |
| ------- | -------------------------------- |
| ID      | DEC-022                          |
| Date    | 2026-04-11                       |
| Feature | Granular MCP server selection    |
| Status  | Accepted                         |

## Context

Users needed to skip specific MCP servers during install. The system needed to remember which servers were intentionally excluded so that `update` doesn't re-prompt for them, while still prompting for genuinely new servers added to the framework.

## Decision

Store `excludedMcp: McpExclusion[]` per tool in the manifest's `ToolEntry`. Each exclusion records `configPath` (merge file path) and `entryKey` (server name). The field is optional in serialization (omitted when empty) for backward compatibility with older manifests.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Separate config file | Decoupled from manifest | Extra file, sync issues | Exclusions are tied to tool install state |
| Infer from absence | No storage needed | Can't distinguish "skipped" from "didn't exist yet" | `update` can't detect genuinely new servers |

## Consequences

- Manifest tracks both what was installed (mergeFiles) and what was skipped (excludedMcp)
- `update` silently skips excluded entries, prompts only for genuinely new ones
- `--force` clears all exclusions and installs everything
- `Manifest.updateToolMergeFiles()` allows partial updates without remove+add hack
