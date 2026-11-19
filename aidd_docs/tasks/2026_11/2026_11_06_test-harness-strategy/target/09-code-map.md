# Code map: current layout to target layout

Index of the file-by-file map. Each part lists every file of its area with its target, the action (keep, move, rename, split, merge, delete, add) and a note. The map is a guide for the refactoring, not a decision: rows marked `proposal:` are placements the design documents do not settle, rows marked `conflict:` record a disagreement between documents and the choice made.

## Parts

Paths in the first seven parts are relative to `cli/`; the harness part is relative to the repository root.

- `code-map/src-framework.md`: `src/contexts/framework` (126 files). Almost every file is renamed or split, so there are no glob rows.
- `code-map/src-tools-translate.md`: `src/contexts/tools` and `src/contexts/translate` (93 files).
- `code-map/src-telemetry.md`: `src/contexts/telemetry` (100 files).
- `code-map/src-runtime-kernel-presentation-distribution.md`: `src/runtime`, `src/kernel`, `src/presentation`, `src/contexts/distribution`, `src/cli.ts` (126 files).
- `code-map/tests-framework.md`: `tests/contexts/framework` (172 files).
- `code-map/tests-tools-translate-distribution-runtime-kernel.md`: the tests of those areas (200 files).
- `code-map/tests-telemetry-presentation-e2e-helpers-architecture-golden-fixtures.md`: the remaining test areas (572 files, fixtures by group).
- `code-map/harness-and-repo.md`: tooling configuration, scripts, rules, memory, workflows, lefthook, `kanban/` (1,418 tracked files outside the source, tests, `plugins/` and `docs/`).

## Measured on the map

- Coverage: every file of `cli/src` and `cli/tests` (1,387) and every tracked harness file outside `plugins/` and `docs/` (1,418) has a row. No row points at a missing file. Checked by a throwaway script that expands the rows against the file tree; the script is not kept in the repository.
- Actions on the 1,387 source and test files: keep 545 (39 %), move 411, rename 239, merge 113, split 71, delete 8. So 61 % of the files change place or name.
- The 8 deletions are not redundancy removals: removing redundant tests needs the relevance rule applied when a module is touched.
- Uncertainty: 235 of 1,116 rows (21 %) are `proposal:`, concentrated in the source of `framework` (35 of 126), the tests of `framework` (47 of 172) and the tests of `tools` (56 of 184). These are the places to review first, and the reason `framework` is not scaled before the pilot.
- Files over 800 lines are split by subject: 11 test files under `tests/contexts/framework` (the largest, `clean-use-case.unit`, has about 3,100 lines).

## How to keep the map true

- A rule of the map: every file has exactly one destination. The check is the one above; at the target it becomes the existing codebase-map architecture test, which already holds the documented tree and the real tree in both directions.
- Each PR of stage B and C updates the rows it executes (status: done) and the other documents it affects, in the same PR.

## Alignments to apply to documents 01 to 08

Decisions the map made, or disagreements it exposed. Each is applied in the numbered document it names; the overview wins on any conflict.

1. Ports folder: the overview puts `ports/` beside `domain/` in each context; documents 05 and 06 keep `domain/ports/`. Align 05 and 06 on the overview.
2. Test file suffix: command tests keep their level suffix (`remove-plugin.unit.test.ts`), because the vitest projects select by suffix. Applied in 07 and in the code map.
3. Profile tests (07, section 3): 34 of the 45 per-tool files of 60 lines or fewer merge into the conformance suite; the 11 longer ones stay as per-tool files. Align 07 with this and with the estimate of 04.
4. Marketplace catalog and related (04 against 02): the catalog and its entry stay in `tools`; `native-marketplace-source` is split (arguments in the profile, parser in `host-registration`); `mcp-launch-command` goes to `tools/domain/formats`. Align 04 on 02.
5. Ownership and scopes (01 against 02): `user-plugin-ownership` goes to `machine-claims`; `resolve-uninstall-scope` to `host-registration`; the init command to `installation`; `ensure-built-marketplace` to `orchestration/marketplace`.
6. Shared technical code (03, 05 and 06): `private-storage-adapter` in `shared/infrastructure` (used by `auth`, `telemetry`, `distribution`); `platform` in `shared/ports`; `user-config-dir` split into a pure function in `shared/domain` and an environment wrapper in `composition`; the prompter adapter in `presentation/terminal/`; `sync-native-activation` in `orchestration/sync`.
7. Telemetry (06): no `legacy/` folder (decided, overview section 15): earlier-measurement cleanup goes to `switch/`, the stored-record upgrade to `storage/`; applied in 06 and in the code map. Four commands at 6 dependencies are split in their PR; command names become verb first (`EnableTelemetry`, `DisableTelemetry`, `ReadTelemetryStatus`, proposals).
8. Helpers (07): `helpers/throwaway-profile.ts` is the home-redirect global setup, not the synthetic tool profiles that 07 section 2.5 describes; the synthetic profiles are a new addition owned by the `tools` kit.
9. Former open verdicts (script tests reading workflow text, three architecture tests, `framework-v2`, mutation helpers, `commands.md`, `kanban/`), the folder-size guard, and the pending overview decisions (`ToolId`, phase 1 of the manifest, `Lock`, menu, canon, caps): all closed in the overview, section 15.
