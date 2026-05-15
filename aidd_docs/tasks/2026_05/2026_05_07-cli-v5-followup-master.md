# Instruction: CLI v5 Follow-up — Master

## Feature

- **Summary**: Forward-looking task index post v5 cleanup. Catalog of 10 candidate workstreams classified by category (features / release / quality / infra). Each links to its own part plan. Final ordering decided after reviewing all parts.
- **Stack**: `Node.js >=24, TypeScript ESM, commander, @inquirer/prompts, tsup, vitest, biome, lefthook`
- **Branch context**: `feat/plugin-architecture` HEAD `1294d87` (post v5 cleanup + DDD refactor + harness)
- **Status**: Index — no implementation. Parts are skeleton plans for evaluation.

## Snapshot — what exists today

- Manifest v5 final schema `{ version, tools, marketplaces }`
- Noun-first surface (`aidd ai/ide/plugin install`)
- 1092 tests passing (87 unit + 17 integration + 6 E2E + 3 command-matrix + 1 sync-matrix + 1 property)
- Mega use-cases split (sync/doctor/restore/uninstall)
- DDD compliance: domain pure, aggregates non-anemic, infra clean
- Verification harness: command-matrix, sync-matrix, property tests automated
- Plugin sync inter-tool: 12 pairs covered (claude/cursor/copilot/codex)
- Memory ownership transferred to plugins
- Marketplace cache subcommand
- Build-dist.sh framework script restored

## Workstreams (10)

### Category A — Features (user-facing value)

| # | Name | File | One-line |
|---|---|---|---|
| 1 | Format adapters marketplace | `2026_05_07-cli-v5-followup-part-1-format-adapters.md` | Ingest Cursor/Copilot/Codex/OpenCode native marketplace formats; emit per-tool target |
| 2 | Plugin re-translation symmetry | `2026_05_07-cli-v5-followup-part-2-plugin-symmetry.md` | Fill capability gaps in sync-matrix (skills/agents/hooks across tools) |
| 3 | OpenCode tool support | `2026_05_07-cli-v5-followup-part-3-opencode.md` | First-class OpenCode emitter + sync support |

### Category B — Release / distribution

| # | Name | File | One-line |
|---|---|---|---|
| 4 | Stable v5 release | `2026_05_07-cli-v5-followup-part-4-stable-release.md` | 4.1.0-beta.11 → 4.1.0 stable on npm + GitHub release |
| 5 | Real-network CI E2E | `2026_05_07-cli-v5-followup-part-5-network-e2e.md` | `aidd setup --source remote` against real GitHub, nightly CI |

### Category C — Quality hardening

| # | Name | File | One-line |
|---|---|---|---|
| 6 | Mutation testing | `2026_05_07-cli-v5-followup-part-6-mutation-testing.md` | Stryker setup, weekly CI run, surface dead assertions |
| 7 | Bundle size budget | `2026_05_07-cli-v5-followup-part-7-bundle-budget.md` | Fail build if `dist/cli.js` exceeds threshold |
| 8 | Performance regression detection | `2026_05_07-cli-v5-followup-part-8-perf-regression.md` | Boot time + version trend tracking |

### Category D — Infrastructure refactor

| # | Name | File | One-line |
|---|---|---|---|
| 9 | FileSystem port split | `2026_05_07-cli-v5-followup-part-9-fs-port-split.md` | 14 methods → 3 ports (Reader/Writer/Merger) per `0-port-design.md` |
| 10 | Collapse infra subdirs | `2026_05_07-cli-v5-followup-part-10-collapse-subdirs.md` | Move `auth/` + `http/` (1 file each) into `adapters/` |

## Cross-cutting considerations

| Concern | Affected parts |
|---|---|
| Backward compatibility | 1 (format adapters), 4 (release), 9 (port split) |
| Network access in CI | 5 (network E2E), 4 (npm publish) |
| Domain purity | 1, 2, 9 (any new value objects must stay pure) |
| Harness coverage | All — each part should add tests under same pyramid (unit-heavy, ≤6 E2E) |
| Locked decisions | Part 1 unblocks decision #12; Part 3 unblocks "OpenCode deferred" |

## Dependency graph

```text
Independent:
  4 (release)        — can ship anytime once 6/7 done
  7 (bundle budget)  — quick win, no deps
  8 (perf regr)      — quick win, no deps
  10 (subdir collapse) — trivial cleanup

Linear chains:
  1 (format adapters) → 2 (plugin symmetry) [refines existing emitters]
  6 (mutation) → 7 (budget) [optional ordering — mutation surfaces test gaps before locking budget]

Independent but related:
  3 (opencode)   — plugs into existing tool registry, can land standalone
  5 (network E2E) — needs CI secret PAT setup
  9 (fs split)   — independent refactor, no user-visible impact

Optimal release sequence:
  C-quick-wins (7 + 8 + 10) → B (4 release) → A (2 then 1) → C (6 mutation) → A (3 opencode) → D (9 fs split)
```

## Decision protocol

1. Each part has its own self-contained plan (LOC estimate, sub-steps, acceptance criteria)
2. Read all 10 parts
3. User picks ordering based on:
   - Strategic priority (user value vs internal quality)
   - Effort budget per cycle
   - Coupling to upcoming features
4. Master is updated with chosen sequence (struck-through items as they land)

## File naming convention

```
2026_05_07-cli-v5-followup-master.md           ← this file
2026_05_07-cli-v5-followup-part-N-<slug>.md    ← individual workstreams
```

After each landed workstream:
- Mark as ✅ in this master
- Add commit SHA(s) to the relevant part
- Move part to `aidd_docs/tasks/2026_05/_done/` (or keep in place with status badge)

## Acceptance for the master

- [ ] All 10 part files exist and are self-contained
- [ ] Each part has clear acceptance criteria + LOC/effort estimate
- [ ] Cross-links between parts work (filenames match)
- [ ] User has reviewed all parts before sequencing
