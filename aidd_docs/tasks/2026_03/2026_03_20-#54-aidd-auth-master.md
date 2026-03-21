# Master Plan: aidd auth command + CLI public on npm

## Overview

- **Goal**: Centralize all auth logic in a dedicated `aidd auth` command and publish CLI to public npm
- **Risk Score**: 10/10
- **Branch**: `feat/aidd-auth`

## Child Plans

| #   | Plan                          | File                                  | Status     | Validated |
| --- | ----------------------------- | ------------------------------------- | ---------- | --------- |
| 1   | Auth infrastructure           | `./2026_03_20-#54-aidd-auth-part-1.md` | pending    | [ ]       |
| 2   | `aidd auth` command           | `./2026_03_20-#54-aidd-auth-part-2.md` | blocked    | [ ]       |
| 3   | Doctor check + npm publish    | `./2026_03_20-#54-aidd-auth-part-3.md` | blocked    | [ ]       |

## Validation Protocol

1. Complete Part 1 — run its tests
2. [ ] Checkpoint 1: All commands work without `--token`, `AIDD_TOKEN` still resolves silently
3. Complete Part 2 — run its tests
4. [ ] Checkpoint 2: `aidd auth login/logout/status` work end-to-end
5. Complete Part 3 — run full test suite
6. [ ] Final: Integration test — fresh install via `npm install -g @ai-driven-dev/cli`, `aidd auth login`, `aidd install`

## Estimations

- **Confidence**: 9/10
- **Duration**: 3 sessions
