---
id: 033
milestone: M3
title: "Wire install command with auto-init support"
stories: [US-008, US-010]
points: 2
blockedBy: [032]
---

# 033: Wire install command with auto-init support

## Context
The install command needs CLI registration with commander, flag handling, and auto-init behavior. When no manifest exists, install should automatically run init with default settings before proceeding.

## Scope
Create the install command presentation layer and implement auto-init logic.

## Acceptance Criteria
- [ ] `aidd install <tools...>` registered with commander accepting variadic tool argument
- [ ] Flags: `--force`, `--framework <path>` (local directory or tarball)
- [ ] Auto-init: when no manifest exists, runs init automatically with default docs dir
- [ ] Auto-init reports: "No installation found. Initializing docs first..."
- [ ] Auto-init does NOT use custom docs dir (user must run `aidd init --docs-dir` first)
- [ ] When manifest already exists, skips init and proceeds directly
- [ ] `aidd install claude` wires global options + local flags to InstallUseCase
- [ ] `aidd install claude cursor copilot` passes multiple tool IDs
- [ ] Success output: lists generated files per tool with summary
- [ ] Error output: user-friendly messages with guidance

## Technical Notes
- **UX Copy source of truth**: ALL user-facing text MUST use exact copy from `aidd_docs/memory/internal/ux_copy.md`. Use keys: `progress.init.auto` ("No installation found. Initializing docs first..."), `error.install.*`, `success.install.*`.
- **User flows reference**: Consult `aidd_docs/memory/internal/user_flows.md` section 2.1 (first-time setup / auto-init + install) for the complete flow.
- Auto-init: check if ManifestRepository.load() returns null. If so, call InitUseCase.execute() first.
- The `--framework` flag overrides remote resolution with a local source.
- Commander variadic argument: `.argument('<tools...>')`.
- Dependency wiring: create all adapters, inject into InstallUseCase.

## Files to Create/Modify
- `src/presentation/commands/install.ts` -- commander registration
- `tests/presentation/commands/install.test.ts` -- command tests

## Tests
- Install command registers correctly with commander
- Auto-init triggers when no manifest exists
- Auto-init skipped when manifest exists
- Multiple tools parsed from variadic argument
- --force flag passed to use case
- --framework flag overrides source
- Error messages are user-friendly

## Done When
- [ ] All acceptance criteria checked
- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Lint passes (`pnpm lint`)
