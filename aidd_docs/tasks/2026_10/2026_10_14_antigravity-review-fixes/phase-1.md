---
status: pending
---

# Instruction: Host profile: user-facing skip message, conformance guard

Owning commit: `feat(cli): add Antigravity CLI as a flat host for skills` on `feat/511-antigravity-host`.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
cli/
├── src/contexts/tools/domain/profiles/antigravity/profile.ts                 ✏️ skip reason without a ticket reference
└── tests/contexts/tools/domain/
    ├── profiles/antigravity/profile.unit.test.ts                             ✏️ assert the new reason
    └── registry-conformance.unit.test.ts                                     ✏️ named opt-out replaces the silent early return
```

## User Journey

```mermaid
flowchart TD
  A[aidd setup --ai antigravity on a hooks plugin] --> B[skip reason printed]
  B --> C[no ticket id in the message]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Check out the host branch => profile and conformance tests present: 5: system
  section Happy path
    Read the antigravity hooks skip reason => it says hooks are not wired yet, with no ticket id: 5: system
    Run the conformance suite => antigravity passes through its named opt-out: 5: system
  section Edge case - new flat-only tool
    A tool declaring plugins with no marketplace contract and no opt-out => conformance runs => the probe assertion fails: 1: system
```

## Tasks to do

### `1)` Skip reason

> The message a user reads carries no ticket reference.

1. Set `hooksUnsupportedReason` to `Antigravity CLI hooks are not wired yet.`
2. Assert that exact string in the profile test instead of `toContain("phase 3")`.

### `2)` Explicit conformance opt-out

> A future flat-only tool cannot skip the marketplace-probe check by accident.

1. Replace the early `return` with a named set of tools exempt from the marketplace probe, holding `antigravity` with a one-line reason.
2. Mutation check: drop `antigravity` from the set, the probe test goes red; restore.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | The antigravity hooks skip reason contains no `#` ticket id and the profile test pins it |
| 2 | Removing antigravity from the opt-out set fails the conformance test for antigravity only |
