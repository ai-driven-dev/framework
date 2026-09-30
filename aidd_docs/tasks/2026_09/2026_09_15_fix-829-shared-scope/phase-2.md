---
status: in-progress
---

# Instruction: finish project-local removal

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
cli/
  src/contexts/framework/application/flows/marketplace-remove-use-case.ts ✏️ local cleanup before orphan detach
  src/contexts/framework/application/uninstall/uninstall-plugin-use-case.ts ✏️ local cleanup before uninstall detach
  src/contexts/framework/application/ownership/project-plugin-cleanup.ts ✏️ reuse or narrow shared cleanup
  tests/contexts/framework/application/flows/ ✏️ Cursor hook and MCP orphan removal
  tests/contexts/framework/application/ ✏️ uninstall failure and B survival
```

## User Journey

```mermaid
flowchart TD
  Shared["A and B share a machine plugin"] --> Remove["A removes a marketplace or uninstalls"]
  Remove --> Local["Remove A's local hooks and any local MCP projection"]
  Local --> Choice{"Local cleanup succeeded?"}
  Choice -- "No" --> Retain["Keep truthful local projection and any existing claim"]
  Choice -- "Yes" --> Detach["Detach A; B and machine plugin remain"]
```

## Test Scope

```mermaid
---
title: Project removal test scope
---
journey
  section Setup
    Install shared Cursor plugin in A and B => local hook and global MCP witnesses ready: 5: cli
  section Happy path
    Remove from A => A integration gone and B still works: 5: cli
  section Edge case - local failure
    Hook or MCP delete fails => A projection and any claim stay for retry: 1: cli
  section Edge case - tool-specific MCP
    Remove OpenCode flat plugin => only A's local MCP entry unmerged: 1: cli
  section Teardown
    Remove B then user clean => machine plugin removed only after both detach: 5: cli
```

## Tasks to do

### `1)` Complete local cleanup before detachment

> Do not leave A's local projections behind without a plugin record; do not remove Cursor's global MCP.

1. Write failing `marketplace remove` and `uninstall plugin` integration tests.
2. Reuse project-local cleanup for hooks/MCP before manifest removal and claim detach.
3. Prove failure retains A's claim and B's global plugin remains intact.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Both commands remove A's project hooks/scripts and any local MCP projection created by that flow before detach; failure retains A's projection and any existing machine claim; Cursor's global MCP, B, and machine-owned state remain unchanged. |
