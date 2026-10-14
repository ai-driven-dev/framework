---
objective: "Setup renders constructor validation failures as clean CLI errors and documents the current user-scope support limits."
status: reviewed
---

# Plan: Render setup validation errors

## Overview
| Field | Value |
| --- | --- |
| **Goal** | Refuse unsupported setup options with a useful message and exit 1, without a stack trace or bundle dump. |
| **Source** | https://github.com/ai-driven-dev/framework/issues/891 and its follow-up comment |

## Phases
| # | Phase | File |
| --- | --- | --- |
| 1 | Guard setup construction and explain user scope | [phase-1.md](./phase-1.md) |

## Resources
| Source | Verified |
| --- | --- |
| `cli/src/presentation/commands/setup.ts` | SetupFlow is constructed before the existing error boundary. |
| `cli/src/contexts/framework/domain/setup-flow.ts` | Constructor validation intentionally refuses plugins and other unsupported user-scope options. |
| `cli/src/presentation/error-handler.ts` | Existing handler prints the message and exits 1. |
| `cli/src/contexts/tools/domain/registry.ts` and profiles | User-scope setup requires native activation or a user install directory; plugin installation scope is a separate declaration. |
| `cli/tests/e2e/helpers.ts` | Built-binary runs isolate user directories and remove host tools from PATH. |
| `cli/aidd_docs/memory/architecture.md` and `testing.md` | Preserve context boundaries; regression evidence must exercise the built binary. |

## Decisions
| Decision | Why |
| --- | --- |
| Move construction into the existing presentation error boundary. | Covers all current and future constructor validation without duplicating domain rules. |
| Reuse README scope documentation and clarify setup help. | Make shipped restrictions discoverable without inventing broader global installation support. |
| Add focused command and built-binary regression coverage. | Domain tests alone cannot detect an escaped command exception. |
| Run typecheck, relevant tests, architecture checks, lint, and hermetic CLI journey. | Validate behavior and responsibility placement; no browser surface exists. |
| Preserve pre-existing `.gitignore` and `.hermes.md` changes outside task commits. | They are unrelated workspace changes. |
