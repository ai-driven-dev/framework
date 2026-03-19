---
name: decision
description: AIDD init signal detection strategy
argument-hint: N/A
---

# Decision: AIDD init signals based on frontmatter, not directories

| Field   | Value                       |
| ------- | --------------------------- |
| ID      | DEC-001                     |
| Date    | 2026-03-18                  |
| Feature | aidd-branding-signals       |
| Status  | Superseded by DEC-003       |

## Context

`aidd init` needs to detect whether a project already has manually installed AIDD files (without a manifest) to redirect users to `aidd adopt`. The original implementation checked for the presence of `.claude/`, `.cursor/`, `.opencode/`, `AGENTS.md` — directories that any user of those tools already has, blocking legitimate first-time installs.

## Decision

Detect AIDD presence by scanning frontmatter `name: aidd:` in tool command directories (`.claude/commands/`, `.cursor/commands/`, `.opencode/commands/`, `.github/prompts/`). `docsDir` existence is checked first as a fast path.

Originally implemented as a private `hasAiddSignals()` method in `InitUseCase` with a hardcoded directory list. Superseded by DEC-003: logic moved to `hasToolSignals()` in `domain/models/tool-config.ts`, directories derived from `ToolConfig.signalDir`.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Directory presence (`.claude/`, `.cursor/`) | Simple, fast | False positives for all existing tool users | Blocked legitimate users |
| AIDD-specific subdirectory (`.claude/commands/aidd/`) | Directory check, no file read | Misses Copilot (no subfolder support) | Inconsistent across tools |
| Filename prefix (`aidd_*`) | No frontmatter parsing | Brittle, copilot-only convention | Not uniform |

## Consequences

- `aidd init` no longer blocks users who already have `.claude/`, `.cursor/` etc.
- Signal detection requires reading file content (more I/O than a directory check)
- Only `commands/` dirs scanned — `rules/` and `agents/` never contain `name: aidd:` frontmatter
- Copilot covered by `.github/prompts/` scan (no subfolder possible in Copilot)
