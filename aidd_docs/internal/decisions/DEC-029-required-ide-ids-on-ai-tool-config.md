# Decision: requiredIdeIds on AiToolConfig for tool-level IDE dependency

| Field   | Value                              |
| ------- | ---------------------------------- |
| ID      | DEC-029                            |
| Date    | 2026-04-20                         |
| Feature | IDE context patch on install       |
| Status  | Accepted                           |

## Context

`ConfigRef.requiredIdeId` answers "which files to skip without IDE context" but not "which AI tools need patching when a new IDE is installed later". `IdePatchUseCase` needs to find relevant AI tools efficiently without iterating all config refs.

## Decision

Add `requiredIdeIds?: readonly IdeToolId[]` to `AiToolConfig`. Copilot declares `requiredIdeIds: ["vscode"] as const`. `IdePatchUseCase` filters already-installed AI tools by `config.requiredIdeIds?.some(id => newIdeIds.includes(id))` to determine which tools to patch.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| Derive from ConfigRef scan | No redundancy | Requires loading all config refs to find affected tools | Expensive; tool-level is the right abstraction |
| Hardcode copilot→vscode mapping in use-case | Simple | Couples use-case to specific tool | Violates open/closed; breaks when new IDE tools added |

## Consequences

- Tool config is the single declaration for IDE dependencies at both file-level (ConfigRef) and tool-level (AiToolConfig)
- Adding a new IDE-aware AI tool = add `requiredIdeIds` to its config; no use-case changes
- `requiredIdeIds` and `ConfigRef.requiredIdeId` are complementary, not redundant
