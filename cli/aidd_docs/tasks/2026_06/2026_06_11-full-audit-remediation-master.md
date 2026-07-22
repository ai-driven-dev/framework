---
name: master_plan
description: Parent plan orchestrating remediation of the 6 ranked top-actions from the 2026-06-11 full audit
argument-hint: N/A
---

# Master Plan: Full-Audit Remediation (2026-06-11)

## Overview

- **Goal**: Remediate the 6 ranked top-actions from `aidd_docs/tasks/audits/2026_06_full.md` — perf hot-path, dependency hygiene, untrusted-catalog security, critical-path test gaps, clean-code sweep, thin-command extraction.
- **Risk Score**: 8/10 (external dep upgrades +2, major refactor +2, 5+ modules +3, breaking policy/doc change +1 — well above the 3 threshold; hence master + child plans).
- **Branch**: `fix/2026-06-audit-remediation/`
- **Source audit**: `aidd_docs/tasks/audits/2026_06_full.md`
- **Repo**: `/aidd/cli` — standalone pnpm package (own `package.json` + `pnpm-lock.yaml`, NOT a workspace member), TypeScript ESM hexagonal CLI, manifest v6, rules in `.claude/rules/**`.

## Child Plans

| #   | Plan                          | File                                                             | Status      | Validated |
| --- | ----------------------------- | --------------------------------------------------------------- | ----------- | --------- |
| 1   | Perf hot-path + baseline      | `./2026_06_11-full-audit-remediation-part-1-perf.md`            | done        | [x]       |
| 2   | Dependency hygiene + policy   | `./2026_06_11-full-audit-remediation-part-2-deps.md`            | done        | [x]       |
| 3   | Untrusted-catalog security    | `./2026_06_11-full-audit-remediation-part-3-security.md`        | done        | [x]       |
| 4   | Critical-path test gaps       | `./2026_06_11-full-audit-remediation-part-4-tests.md`           | done        | [x]       |
| 5   | Clean-code sweep              | `./2026_06_11-full-audit-remediation-part-5-clean-code.md`      | done        | [x]       |
| 6   | Thin-command extraction       | `./2026_06_11-full-audit-remediation-part-6-thin-command.md`    | done        | [x]       |

<!-- Status values: pending, in-progress, done, blocked -->
<!-- Parts are NOT strictly sequential; the order below is recommended to avoid merge collisions on shared files. One soft dependency exists: Part 6 reuses Part 5's `isAiToolId` guard — apply 5 before 6 (the recommended order already does), or Part 6 falls back to the inline idiom / creates the guard locally. All other parts are independently applicable. -->

## Recommended apply order (collision-aware)

Each part is self-contained, but several touch the same files. Apply in this order to minimize merge conflicts:

1. **Part 5 (clean-code)** first — deletes dead code and adds `isAiToolId` guard; smallest, lowest-risk, and reduces noise other parts read around. Touches `file-adapter.ts`, `deps.ts`, `registry.ts`.
2. **Part 3 (security)** — also edits `file-adapter.ts` (`deepMerge`); after Part 5's `stripJsoncComments` dedup lands, the file is already in motion. Touches `file-adapter.ts`, `deps.ts`.
3. **Part 6 (thin-command)** — extracts use-cases, edits `deps.ts`, `ai.ts`, `ide.ts`. Shares the per-tool primitive that Part 5's `isAiToolId` cleanup touches in `ai.ts`.
4. **Part 1 (perf)** — edits `cli.ts`, `check-update-use-case.ts`, `deps.ts`, `scripts/perf-baseline.json`.
5. **Part 2 (deps)** — edits `package.json`, `pnpm-lock.yaml`, `aidd_docs/memory/architecture.md`; mostly isolated.
6. **Part 4 (tests)** — only adds files under `tests/` + edits `vitest.config.ts`; runs last so the coverage gate measures the final code.

### Shared-file touchpoints (risk register)

| File                                              | Touched by parts | Collision risk | Mitigation                                                     |
| ------------------------------------------------- | ---------------- | -------------- | ------------------------------------------------------------- |
| `src/infrastructure/deps.ts`                      | 1, 5, 6          | high           | Apply in order above; each part adds distinct lines           |
| `src/infrastructure/adapters/file-adapter.ts`     | 3, 5             | medium         | Part 5 (delete clone) then Part 3 (`deepMerge` guard)         |
| `src/application/commands/ai.ts`                  | 5, 6             | medium         | Part 5 swaps inline cast → `isAiToolId`; Part 6 removes the loop |
| `src/infrastructure/deps.ts` `Deps` interface     | 1, 6             | low            | Distinct fields appended                                      |

## Validation Protocol

1. Complete each part, run its `success_condition`.
2. [ ] Checkpoint per part: `pnpm typecheck`, `pnpm lint`, and the part's targeted tests pass.
3. [ ] Final integration: `pnpm test` green AND `pnpm test --coverage` passes the 85/90/80/85 gate AND `pnpm audit --prod` clean for fast-uri AND `pnpm knip:production` reports zero dead code AND `pnpm bench:check` passes against the re-captured baseline.

## Estimations

- **Confidence**: 9/10
- **Duration**: ~3-4 dev-days total (Part 4 tests ~1d, Part 2 deps ~0.5d incl. major-bump testing, rest ~0.5d each).
