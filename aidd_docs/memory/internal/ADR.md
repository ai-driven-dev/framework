# Architecture Decision Record (ADR)

This file contains the key architectural decisions made during the project, along with their context and consequences.

## Decision Log

| Date       | ID      | Title                                                        | Consequences                                      |
| ---------- | ------- | ------------------------------------------------------------ | ------------------------------------------------- |
| 2026-03-18 | DEC-001 | [Framework config follows `config/<tool>/` convention](#dec-001) | `CONFIG_REFS` in CLI must mirror framework paths |

---

## DEC-001 — Framework config follows `config/<tool>/` convention

| Field   | Value                   |
| ------- | ----------------------- |
| ID      | DEC-001                 |
| Date    | 2026-03-18              |
| Feature | opencode                |
| Status  | Accepted                |

### Context

Each AI tool installed by the CLI has its config template stored in the framework under `config/<tool>/` (e.g., `config/.vscode/settings.json`, `config/.opencode/opencode.json`). The CLI's `CONFIG_REFS` in `framework-loader-adapter.ts` must reference these exact paths. A mismatch caused `opencode.json` to be generated without the `instructions` field.

### Decision

All tool-specific config templates in the framework live under `config/<tool>/`, never directly under `config/`. `CONFIG_REFS` in the CLI must use this path convention.

### Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| ----------- | ---- | ---- | ---------------- |
| Flat `config/opencode.json` | Simpler path | Breaks the `config/<tool>/` convention used by all other tools | Inconsistent with `.vscode/`, `.claude/` pattern |

### Consequences

- New tool configs must be placed at `config/<tool>/` in the framework.
- When adding a new `CONFIG_REFS` entry in the CLI, always verify the actual path in the framework first.
- Test fixtures must mirror the `config/<tool>/` structure.
