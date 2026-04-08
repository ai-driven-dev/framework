# Master Plan: Typed Domain Exceptions + ErrorHandler

## Overview

- **Goal**: Replace inline error strings in adapters with typed domain exceptions and introduce a global ErrorHandler, removing logic from CLIOutput
- **Risk Score**: 8/10
- **Branch**: `refactor/113-typed-exceptions-error-handler`

## Child Plans

| #   | Plan                        | File                                                  | Status  | Validated |
| --- | --------------------------- | ----------------------------------------------------- | ------- | --------- |
| 1   | Foundation                  | `./2026_04_08-#113-typed-exceptions-error-handler-part-1.md` | pending | [ ]       |
| 2   | Migration + Rules           | `./2026_04_08-#113-typed-exceptions-error-handler-part-2.md` | blocked | [ ]       |

## Validation Protocol

1. Complete Part 1, run typecheck
2. [ ] Checkpoint 1: no regressions, ErrorHandler wired and reachable
3. Unblock Part 2, migrate commands + update rules
4. [ ] Final: typecheck passes, no `output.exit` calls remain

## Estimations

- **Confidence**: 9/10
- **Duration**: 1-2h
