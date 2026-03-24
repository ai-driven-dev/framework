---
name: decision
description: Runtime path resolution via ConfigHandler.resolveOutputPath
argument-hint: N/A
---

# Decision: Runtime output path resolution in ConfigHandler

| Field   | Value                             |
| ------- | --------------------------------- |
| ID      | DEC-012                           |
| Date    | 2026-03-24                        |
| Feature | opencode.jsonc detection          |
| Status  | Accepted                          |

## Context

opencode accepts both `opencode.json` and `opencode.jsonc`. The CLI was always writing to `opencode.json`, creating a duplicate when the user already had a `.jsonc`. The output path needed to be resolved at runtime based on which file exists on disk.

## Decision

Add an optional async method `resolveOutputPath?(configName, projectRoot, fs): Promise<string | null>` to the `ConfigHandler` domain interface. When present, `generateDistribution` calls it instead of `outputPath`. Tools that need static paths implement only `outputPath`; tools that need runtime resolution override `resolveOutputPath`. `generateDistribution` becomes async as a consequence.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Patch path in use case after generation | No interface change | Tool identity leaks into use case | Use cases must not know about specific tools |
| Separate application-layer resolver file | Simple to write | Same leak, just indirected | Same reason |

## Consequences

- Use cases stay fully generic — no tool names, no file name strings
- Any future tool with dynamic output paths follows the same pattern
- `generateDistribution` is now async; all callers must await it
