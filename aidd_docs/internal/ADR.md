# Architecture Decision Record (ADR)

This file contains the key architectural decisions made during the project, along with their context and consequences.

## Decision Log

| Date       | ID      | Title                                                                                   | Consequences                                              |
| ---------- | ------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 2026-03-18 | DEC-001 | [AIDD signals based on frontmatter](./decisions/DEC-001-aidd-signals-frontmatter.md)   | init no longer blocks existing tool users                 |
| 2026-03-18 | DEC-002 | [Tool helpers in tool-config.ts](./decisions/DEC-002-tool-helpers-in-tool-config.md)   | single source for tool config logic, no shared.* files    |
| 2026-03-19 | DEC-003 | [signalDir on ToolConfig, hasToolSignals in domain](./decisions/DEC-003-signal-dir-in-tool-config.md) | signal detection shared between init and doctor via domain |
| 2026-03-19 | DEC-004 | [Doctor checks both directions manifest↔disk](./decisions/DEC-004-doctor-bidirectional-checks.md) | missing tracked files now surface as errors |
