---
name: decision
description: signalDir as domain data on ToolConfig, hasToolSignals shared in domain
argument-hint: N/A
---

# Decision: signalDir on ToolConfig, hasToolSignals in domain

| Field   | Value                          |
| ------- | ------------------------------ |
| ID      | DEC-003                        |
| Date    | 2026-03-19                     |
| Feature | doctor-signal-detection        |
| Status  | Accepted                       |

## Context

`DoctorUseCase` needed the same signal detection as `InitUseCase` (`hasAiddSignals`) to fix a false positive on `.github/` orphan detection. The logic was private and hardcoded in `InitUseCase`. Duplicating it would violate DEC-002. Putting a shared function in `application/` as a standalone file was rejected (rule: no non-use-case files in `application/`).

## Decision

Add `signalDir: string` (pure data) to the `ToolConfig` interface in `domain/models/tool-config.ts`. Add `export async function hasToolSignals(fs: FileSystem, config: ToolConfig, projectRoot)` in the same file. Each tool declares its signal dir; the shared function handles the I/O. Both `InitUseCase` and `DoctorUseCase` consume `hasToolSignals()`.

| Tool | signalDir |
|------|-----------|
| claude | `.claude/commands` |
| cursor | `.cursor/commands` |
| opencode | `.opencode/commands` |
| copilot | `.github/prompts` |

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| `hasAiddSignals()` method on `ToolConfig` interface | Encapsulated per tool | Mixes I/O into pure config object; harder to unit test | Config objects should be pure data |
| Standalone `application/aidd-signals.ts` | Close to use cases | Violates project rule: no non-use-case files in `application/` | Architecture constraint |
| Keep private in `InitUseCase`, duplicate in `DoctorUseCase` | No new abstractions | Duplicated logic, hardcoded dirs out of sync | DEC-002 violated |

## Consequences

- `tool-config.ts` now has a thin async function with I/O via domain port `FileSystem` — acceptable since ports are defined in domain
- Signal dirs are the single source of truth: adding a new tool automatically covers both init and doctor
- `InitUseCase.hasAiddSignals()` is simplified to a loop over `getAllRegisteredTools()`
- Extends DEC-001 (frontmatter strategy) and reinforces DEC-002 (tool-config.ts as shared location)
