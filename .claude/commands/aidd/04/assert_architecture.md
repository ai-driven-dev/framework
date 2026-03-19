---
name: 'aidd:04:assert_architecture'
description: 'Verify code conforms to architecture diagrams, ADRs, and project structure.'
argument-hint: [Optional scope to verify (module, service, or layer name)]
---

# Assert Architecture Prompt

## Goal

Verify that the codebase (or a specific scope) conforms to the documented architecture: C4 diagrams, ADRs, and project tree structure.

## Context

### Architecture diagrams (micro)

```shell
! ls -1tr aidd_docs/memory/internal/
```

### Architecture decisions

```shell
! ls -1tr aidd_docs/internal/decisions/
```

### Scope

```text
$ARGUMENTS
```

## Rules

- Read ALL architecture sources before checking code
- Report violations with file path, line, and which constraint is violated
- Distinguish macro violations (service boundaries, tree structure) from micro violations (layer imports, patterns)
- Do not fix violations — only report them
- If no scope is provided, check the entire project
- Use `!` backtick pattern to inspect project structure and imports

## Steps

1. Load architecture context:
   - Remember architecture diagrams from `aidd_docs/memory/architecture.md`
   - Read micro diagrams from `aidd_docs/memory/internal/` (if scope targets a specific module)
   - Read ADRs from `aidd_docs/internal/decisions/`
   - Extract the expected project tree structure from diagrams

2. Verify macro architecture (service boundaries):
   - Read the expected tree structure from `aidd_docs/memory/architecture.md`
   - Compare actual code structure against the documented tree
   - Check for files outside expected boundaries
   - Check for direct imports between independent services

3. Verify micro architecture (internal layers):
   - For each module in scope, check import directions match layer constraints
   - Verify domain layer has zero external imports
   - Verify application layer only depends on domain (via ports)
   - Check for circular dependencies between modules
   - Verify patterns: use cases have ports, adapters implement interfaces

4. Generate violation report:
   - List each violation with: severity (critical/warning), file path, constraint violated, suggested fix
   - Group by macro vs micro
   - If zero violations, confirm conformity

5. Summarize: total violations, critical count, and recommended next actions.
