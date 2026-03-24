---
name: decision
description: SetupUseCase non-interactive override options
argument-hint: N/A
---

# Decision: SetupUseCase non-interactive override options

| Field   | Value                        |
| ------- | ---------------------------- |
| ID      | DEC-010                      |
| Date    | 2026-03-24                   |
| Feature | SetupUseCase                 |
| Status  | Accepted                     |

## Context

`SetupUseCase` was designed as purely interactive — `handleInit` and `handleAdopt` always called the prompter for `docsDir`, framework source, `toolIds`, and `from`. This made programmatic use (e.g. test helpers) impossible without mocking the prompter or bypassing `SetupUseCase` entirely by calling `InitUseCase`/`AdoptUseCase` directly, duplicating orchestration logic.

## Decision

Extend `SetupOptions` with optional override fields: `docsDir?`, `toolIds?`, `from?`, `interactive?`. When provided, the corresponding prompter calls are skipped — the value is used directly. Interactive paths remain unchanged when overrides are absent. `runInstall` also gains `interactive?` to skip the install checkbox in non-interactive contexts.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Call `InitUseCase`/`AdoptUseCase` directly in helpers | Simple, no SetupUseCase changes | Duplicates orchestration; helpers diverge from production path | SetupUseCase is the canonical entry point |
| Mock the prompter in tests | No use-case changes | Fragile (order-dependent), leaks test concerns into architecture | Brittle and not idiomatic |

## Consequences

- `SetupUseCase` can be called non-interactively with explicit params — no prompter required
- Test helpers route through the same code path as production
- `setup` command explicitly passes `interactive: true` to preserve TTY behavior
- Any future non-interactive caller (scripts, CI) can use `SetupUseCase` directly
