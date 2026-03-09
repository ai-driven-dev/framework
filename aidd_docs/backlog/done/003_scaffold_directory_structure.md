---
id: 003
milestone: M0
title: "Scaffold directory structure and framework.json fixture"
stories: []
points: 0
blockedBy: [002]
---

# 003: Scaffold directory structure and framework.json fixture

## Context
The 4-layer architecture (ADR-001) requires a specific directory structure. A framework.json fixture is needed for all domain layer tests in M1. CI pipeline should also be set up.

## Scope
Create the full directory structure per architecture.md. Create a realistic framework.json test fixture. Optionally set up GitHub Actions CI.

## Acceptance Criteria
- [ ] Directory structure matches architecture.md exactly:
  - `src/domain/models/`
  - `src/domain/ports/`
  - `src/domain/tool-specs/`
  - `src/application/use-cases/`
  - `src/infrastructure/adapters/`
  - `src/infrastructure/http/`
  - `src/infrastructure/tar/`
  - `src/infrastructure/cache/`
  - `src/infrastructure/auth/`
  - `src/presentation/commands/`
- [ ] Each directory contains a `.gitkeep` or placeholder index file
- [ ] `tests/fixtures/framework.json` exists with a realistic framework descriptor:
  - Version field
  - Content sections (agents, commands, rules, skills) with directory paths, organization types, and entry file references
  - Template references (memoryBank, docsReadme)
  - Config references (mcp, vscodeDir)
- [ ] `tests/fixtures/` contains sample content files matching the framework descriptor
- [ ] `src/presentation/presenter.ts` placeholder exists
- [ ] Directory structure is verified by an automated test (readdir assertion)

## Technical Notes
- ADR-001: Clean Architecture with 4 layers. Dependencies always point inward (presentation -> application -> domain; infrastructure -> domain).
- ADR-006: framework.json is the contract. The fixture must be realistic enough for M1 domain tests.
- The fixture should include at least 2-3 files per content section to test distribution generation.

## Files to Create/Modify
- `src/domain/models/` -- empty directory with placeholder
- `src/domain/ports/` -- empty directory with placeholder
- `src/domain/tool-specs/` -- empty directory with placeholder
- `src/application/use-cases/` -- empty directory with placeholder
- `src/infrastructure/adapters/` -- empty directory with placeholder
- `src/infrastructure/http/` -- empty directory with placeholder
- `src/infrastructure/tar/` -- empty directory with placeholder
- `src/infrastructure/cache/` -- empty directory with placeholder
- `src/infrastructure/auth/` -- empty directory with placeholder
- `src/presentation/commands/` -- empty directory with placeholder
- `src/presentation/presenter.ts` -- output formatting placeholder
- `tests/fixtures/framework.json` -- framework descriptor fixture
- `tests/fixtures/content/` -- sample framework content files
- `tests/structure.test.ts` -- directory structure verification test

## Tests
- Structure test verifies all expected directories exist
- framework.json fixture is valid JSON and has required fields

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
