---
name: decision
description: ConfigHandler.mergeStrategy() replaces boolean shouldMerge
---

# Decision: ConfigHandler.mergeStrategy() replaces boolean shouldMerge

| Field   | Value                      |
| ------- | -------------------------- |
| ID      | DEC-016                    |
| Date    | 2026-04-06                 |
| Feature | mcp-json-merge-strategy    |
| Status  | Accepted                   |

## Context

`ConfigHandler.shouldMerge(name): boolean` could only express "do we merge this file?" but not "who wins on conflict?". The implicit assumption was always framework-prime. When `.mcp.json` needed user-prime behavior to preserve user customizations on `aidd update`, the boolean was insufficient.

## Decision

Replace `shouldMerge: boolean` with `mergeStrategy(): MergeStrategy` where `MergeStrategy = "none" | "framework-prime" | "user-prime"`. The strategy flows through `GeneratedFile.mergeStrategy`, `collectRawFiles`, and into `mergeJsonFile(path, content, strategy)`. Direction is inverted in `deepMerge` by swapping arguments: `deepMerge(incoming, existing)` for user-prime, `deepMerge(existing, incoming)` for framework-prime.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Per-key hashing in manifest | Precise auto-removal of framework-removed entries | Manifest schema change, high complexity | Scoped to DEC-017 / issue #123 |
| Separate `mergePriority()` method | Keeps `shouldMerge` unchanged | Two methods to maintain, implicit coupling | One method encoding both concerns is simpler |
| TypeScript enum | Autocomplete, rename-safe | Runtime code emitted, `const enum` breaks ESM/isolatedModules | String union type is zero-cost and consistent with codebase |

## Consequences

- MCP config files (`claude`, `copilot`, `cursor`) are now user-prime: user additions survive `aidd update`
- `.vscode/settings.json` retains framework-prime behavior (unchanged)
- `opencode.json` retains framework-prime (merged tool + mcp config, complex transform)
- `mergeJsonFile` signature is a breaking change to the `FileSystem` port — all callers must pass strategy
- Foundation for future merge-strategy extensions without changing the port again
