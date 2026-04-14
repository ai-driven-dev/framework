# Decision: Shared domain functions for JSON entry operations

| Field   | Value                            |
| ------- | -------------------------------- |
| ID      | DEC-023                          |
| Date    | 2026-04-11                       |
| Feature | Granular MCP server selection    |
| Status  | Accepted                         |

## Context

Install, uninstall, and update use-cases all needed to parse JSON section keys and surgically remove entries from JSON files. The logic was duplicated across use-cases (`parseEntryKeys` in install + update, `removeKeysFromJsonFile` in uninstall + update).

## Decision

Extract pure JSON transformation functions to `src/domain/models/merge-entry.ts`:
- `parseEntryKeys(content, sectionKey)` — returns keys from a JSON section
- `removeEntriesFromJson(content, sectionKey, keysToRemove)` — returns JSON string with keys removed

Use-cases handle I/O (`fs.readFile`/`fs.writeFile`) and delegate the transformation to these shared functions.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Add to FileSystem port | Single call site | Port already has 13 methods; mixes I/O with logic | Violates port SRP |
| Shared use-case class | Encapsulates pattern | Overkill for pure functions | No state, no dependencies needed |

## Consequences

- Zero duplication for JSON entry operations across use-cases
- Domain layer owns the transformation; use-cases own the I/O
- `merge-entry.ts` is the canonical location for all merge entry operations
