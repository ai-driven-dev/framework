---
id: 015
milestone: M1
title: "Implement Manifest domain aggregate root"
stories: []
points: 0
blockedBy: [010]
---

# 015: Implement Manifest domain aggregate root

## Context
The Manifest is the aggregate root that tracks all installed tools, their file hashes, framework versions, and docs configuration. It is the central data structure for status detection, install/uninstall operations, and change tracking.

## Scope
Implement Manifest with its core methods: addTool, removeTool, computeStatus, hasTool, getToolVersion. Also implement ToolEntry, DocsEntry, and TrackedFile supporting types.

## Acceptance Criteria
- [ ] `Manifest` holds: docsDir (optional, omitted if default), FrameworkConfig with version and tool entries
- [ ] `ToolEntry` holds: toolId, version, array of TrackedFile
- [ ] `DocsEntry` holds: version, array of TrackedFile
- [ ] `TrackedFile` holds: relativePath, FileHash
- [ ] `addTool(toolId, version, files: GeneratedFile[])` -- adds or replaces a tool entry with file tracking
- [ ] `removeTool(toolId)` -- removes a tool entry, preserves other tools and docs
- [ ] `computeStatus(diskHashes: Map<string, FileHash>): StatusReport` -- classifies files as unmodified, modified, deleted, or untracked
- [ ] `hasTool(toolId): boolean` -- checks if a tool is installed
- [ ] `getToolVersion(toolId): string | undefined` -- returns the framework version for a tool
- [ ] `computeStatus` correctly handles: files unchanged (hash match), files modified (hash mismatch), files deleted (in manifest but not on disk), files added (on disk but not in manifest)
- [ ] Manifest can be constructed from plain data (for JSON deserialization)
- [ ] Manifest can be serialized to plain data (for JSON serialization)
- [ ] Zero infrastructure imports

## Technical Notes
- ADR-007: Manifest stored as `.aidd/config.json`. The Manifest model owns the data structure; ManifestRepositoryAdapter handles I/O.
- computeStatus is the core drift detection logic used by StatusUseCase.
- The manifest never stores auth tokens (ADR-008 security constraint).
- docsDir is only stored if non-default (to keep the manifest minimal).

## Files to Create/Modify
- `src/domain/models/manifest.ts` -- Manifest aggregate root
- `src/domain/models/tool-entry.ts` -- ToolEntry
- `src/domain/models/docs-entry.ts` -- DocsEntry
- `src/domain/models/tracked-file.ts` -- TrackedFile
- `tests/domain/models/manifest.test.ts` -- comprehensive Manifest tests

## Tests
- addTool adds a new tool with correct files
- addTool replaces an existing tool entry
- removeTool removes only the specified tool
- removeTool on non-existent tool throws
- hasTool returns true/false correctly
- getToolVersion returns version or undefined
- computeStatus: all in sync -> empty report
- computeStatus: modified file -> appears in modified list
- computeStatus: deleted file -> appears in deleted list
- computeStatus: untracked file -> appears in untracked list
- computeStatus: mixed scenario (modified + deleted + untracked)
- Serialization round-trip (construct -> serialize -> reconstruct)

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
