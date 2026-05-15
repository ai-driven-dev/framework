---
paths:
  - "src/domain/models/**/*.ts"
  - "src/application/use-cases/**/*.ts"
---

# Domain Value Objects and Discriminant Types

## Discriminant types

- Every discriminant string union used in ≥2 use-cases → named type in `src/domain/models/`
- Never inline `type Foo = "a" | "b"` in use-case files

## Value objects

- All fields `readonly`
- No setters — return new instance for mutations
- Validate invariants in constructor, throw on invalid input
- Use params object when ≥3 constructor parameters
- Static factory only when multiple distinct creation paths exist
- Implement `.equals()` when used in comparisons or collections

## Constants

- Module-level `const` in `CONSTANT_CASE` above the class definition
- Named constant for any literal used more than once

## Import rules

- Files in `src/domain/models/` must not import from `src/application/` or `src/infrastructure/`
- Cross-domain imports within `src/domain/models/` are allowed

## Canonical locations

| Type               | File                                  |
| ------------------ | ------------------------------------- |
| `FileDiffKind`     | `src/domain/models/file.ts`           |
| `FileDiff`         | `src/domain/models/file.ts`           |
| `ConflictDecision` | `src/domain/models/merge.ts`          |
| `ToolScope`        | `src/domain/models/tool-scope.ts`     |
| `SYNC_EXCLUDED_FILES` | `src/domain/models/sync-policy.ts` |
| `isSyncExcluded`   | `src/domain/models/sync-policy.ts`    |
| `MergeStrategy`    | `src/domain/models/merge.ts`          |
| `MergeFileEntry`   | `src/domain/models/merge.ts`          |
| `McpExclusion`         | `src/domain/models/mcp-exclusion.ts`   |
| `mcpExclusionEquals`   | `src/domain/models/mcp-exclusion.ts`   |
| `extractMcpKeys`       | `src/domain/models/mcp-exclusion.ts`   |
| `filterMcpExclusions`  | `src/domain/models/mcp-exclusion.ts`   |
| `computeMcpExclusions` | `src/domain/models/mcp-exclusion.ts`   |
| `detectNewMcpEntries`  | `src/domain/models/mcp-exclusion.ts`   |
| `UserFileSectionKey`   | `src/domain/tools/contracts.ts`        |
| `UserFileSection`      | `src/domain/tools/contracts.ts`        |
| `AiToolId`             | `src/domain/models/tool-ids.ts`        |
| `IdeToolId`            | `src/domain/models/tool-ids.ts`        |
| `ToolId`               | `src/domain/models/tool-ids.ts`        |
| `ToolCategory`         | `src/domain/models/tool-ids.ts`        |
| `AI_TOOL_IDS`          | `src/domain/models/tool-ids.ts`        |
| `IdeToolConfig`        | `src/domain/tools/contracts.ts`        |
| `AiTool`               | `src/domain/tools/contracts.ts`        |
| `HasAgents`            | `src/domain/tools/contracts.ts`        |
| `HasSkills`            | `src/domain/tools/contracts.ts`        |
| `HasCommands`          | `src/domain/tools/contracts.ts`        |
| `HasRules`             | `src/domain/tools/contracts.ts`        |
| `HasMcp`               | `src/domain/tools/contracts.ts`        |
| `HasHooks`             | `src/domain/tools/contracts.ts`        |
| `HasMemory`            | `src/domain/tools/contracts.ts`        |
| `HasSettings`          | `src/domain/tools/contracts.ts`        |
| `ToolConfig`           | `src/domain/tools/registry.ts`         |
| `isAiTool`             | `src/domain/tools/registry.ts`         |
| `registerTool`         | `src/domain/tools/registry.ts`         |
| `getToolConfig`        | `src/domain/tools/registry.ts`         |
| `AgentsCapability`     | `src/domain/capabilities/agents-capability.ts`   |
| `CommandsCapability`   | `src/domain/capabilities/commands-capability.ts` |
| `HooksCapability`      | `src/domain/capabilities/hooks-capability.ts`    |
| `McpCapability`        | `src/domain/capabilities/mcp-capability.ts`      |
| `RulesCapability`      | `src/domain/capabilities/rules-capability.ts`    |
| `SettingsCapability`   | `src/domain/capabilities/settings-capability.ts` |
| `SkillsCapability`     | `src/domain/capabilities/skills-capability.ts`   |
