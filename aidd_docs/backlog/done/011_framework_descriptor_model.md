---
id: 011
milestone: M1
title: "Implement FrameworkDescriptor domain model"
stories: []
points: 0
blockedBy: [010]
---

# 011: Implement FrameworkDescriptor domain model

## Context
The FrameworkDescriptor is the parsed representation of framework.json. It is how the CLI discovers content directories, templates, and config file references. ADR-006 mandates that no content paths are hardcoded -- the descriptor is the contract.

## Scope
Implement FrameworkDescriptor as a domain value object that can be constructed from parsed JSON data. It must provide content section lookup, template references, and config references.

## Acceptance Criteria
- [ ] `FrameworkDescriptor` holds version (string), content sections, template references, config references
- [ ] Content sections have: name, dir, organization (flat/phase-directories/category-directories/one-directory-per-skill), optional entryFile
- [ ] `getContentSection(name: string): ContentSection | undefined` lookup method
- [ ] `getTemplate(name: string): TemplateRef | undefined` lookup method
- [ ] `getConfig(name: string): ConfigRef | undefined` lookup method
- [ ] Construction from the framework.json fixture produces a valid descriptor
- [ ] Invalid framework.json (missing version, missing content sections) throws descriptive errors
- [ ] Zero infrastructure imports

## Technical Notes
- ADR-006: Framework descriptor as contract. The CLI adapts to framework structure changes without code changes.
- The fixture from ticket 003 (`tests/fixtures/framework.json`) is the source of truth for test data.
- Content section organization types drive distribution generation (flat vs nested).
- ToolSpec will use this to know where to find content per category.

## Files to Create/Modify
- `src/domain/models/framework-descriptor.ts` -- FrameworkDescriptor, ContentSection, TemplateRef, ConfigRef
- `tests/domain/models/framework-descriptor.test.ts` -- tests using the framework.json fixture

## Tests
- Construction from valid fixture data
- Lookup by content section name (agents, commands, rules, skills)
- Lookup by template name (memoryBank, docsReadme)
- Lookup by config name (mcp, vscodeDir)
- Rejection of invalid data (missing version, empty content sections)

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
