---
status: implemented
---

# Instruction: Guard setup validation

## Architecture projection
```txt
cli/
  src/presentation/commands/setup.ts                       modify: guard constructor and clarify help
  tests/presentation/commands/setup-wiring.integration.test.ts  modify: prove constructor failures render before dependency creation
  tests/e2e/setup-scope-user.e2e.test.ts                    modify: prove clean refusal in the real binary
  tests/golden/snapshots/help/surface.json                  modify: record the intended setup help change
  README.md                                               modify: document current scope support and restrictions
```
No source files are created or deleted. Domain validation and tool activation remain unchanged.

## User Journey
```mermaid
flowchart TD
  A[Run setup with user scope] --> B{Supported options?}
  B -->|No| C[Read validation message and remedies; exit 1]
  B -->|Yes| D[Register shared source and supported tool; exit 0]
  E[Read setup help and README] --> F[Discover scope limits before installation]
```

## Test Scope
```mermaid
journey
  section Setup
    Create isolated project and user directories => no real profile touched: 5: system
  section Happy path
    Run supported user-scope setup with plugins none => exit 0 and project unchanged: 5: cli
    Read setup help => restrictions discoverable: 5: cli
  section Edge case - unsupported plugin mode
    User scope with all or recommended or named plugins => setup => message and remedies with exit 1 and no stack or bundle dump: 1: cli
  section Edge case - other constructor validation
    User scope with no AI tools or an IDE or an unsupported AI tool => setup => clean validation error before dependencies: 1: cli
  section Teardown
    Remove isolated directories => baseline restored: 5: system
```

## Wireframe
Not applicable: command-line validation only.

## Tasks to do
### 1) Reproduce and guard constructor errors
1. Add regression tests and demonstrate failure against the current command.
2. Move SetupFlow construction and dependent banner into the existing try block before dependency creation.
3. Preserve the existing error messages, exit status, domain policy, and supported setup behavior.

### 2) Explain shipped scope support
1. Extend the existing README scope documentation with support grounded in current profiles and registry.
2. Clarify setup help: explicit supported AI tools, no IDE tools, no plugin enabling at user scope; native activation depends on available host CLI.
3. Distinguish setup registration from plugin installation and avoid promising global configuration rewriting.
4. Regenerate the existing help golden snapshot and confirm only setup help changes.

### 3) Validate
1. Run relevant command, domain, and user-scope e2e tests, typecheck, architecture suite, and lint on changed files.
2. Reproduce the issue through the hermetic built-binary tests after other checks.
3. Report exact commands and results, including limitations.

## Test acceptance criteria
| Task | Acceptance criteria |
| --- | --- |
| 1 | Unsupported plugin modes print the existing cause and remedies, exit 1, and emit no exception name, stack frame, or minified bundle; dependencies are not created. Other constructor validation errors use the same boundary. |
| 2 | Help and README accurately explain current user-scope setup and plugin installation limitations from source; no installation capability is added. |
| 3 | Relevant tests, typecheck, architecture checks, and changed-file lint pass; built-binary reproduction runs with isolated user directories. |
