# Review: The report answers about one task, ticket, person or more

- Rounds: 3
- Started: 2026-10-15

## Round 1 · r-7c3e

- Date: 2026-10-15
- By: Baptiste LAFOURCADE
- Diff: `ae8705f7...6651b9f7`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 10/10 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

Criteria are the contract's acceptance 1-10, the authority the plan's phase tables fold into.

### Criteria

- [x] 1. A filtered report adds up to the row it selects, `day` by its period, `total` by no filter, and every axis of it adds up to its totals — `cli/tests/contexts/telemetry/application/report/report-filters.property.integration.test.ts:207`, green on rerun (`Test Files 42 passed`, `Tests 420 passed`)
- [x] 2. Filters commute and combine with AND — same file `:230`, green
- [x] 3. Bounded and filtered equals unbounded, filtered, restricted to the period, prefixes resolved on the period — `report-window.property.integration.test.ts`, green; the evidence's mutation `resolvedIn(held.records, …)` was killed by it
- [x] 4. Every error of rules 1, 2, 3, 5, 6, 7 exits 1 naming the flag, those of 1, 2, 3, 6, 7 before anything is read — `telemetry-wiring.integration.test.ts` (repeat, empty, choice, conflict tables), `report-usage-use-case.unit.test.ts:464` (gone, outside, unreadable, no id: `s.events` empty); built binary in a sandbox: every case exit 1 with the flag named
- [x] 5. `.` resolves in a linked worktree and the main tree to the id ingest stored — `telemetry-report.e2e.test.ts:541`, green (`Tests 25 passed`); sandbox: main tree, subdirectory, linked worktree and an origin-less repository (root commit `97d2ea86…`) each equal the `--axis repository` key
- [x] 6. No filter: today's envelope plus `filters` all `null` — `report-usage-use-case.unit.test.ts:349`, `report-envelope.unit.test.ts:112`; sandbox keys `version,period,axis,filters,rows,totals,unknown_records,coverage`, every filter `null`
- [x] 7. Tests written first, red run recorded — `evidence.md`, Red runs, phases 1-3, each guard also broken and seen red
- [x] 8. Telemetry mutation at 96 or above, every changed-line mutant killed or explained — `evidence.md` Gates (96.2, floor 96); `cli/reports/mutation/telemetry/mutation.json` holds exactly 10 survivors or uncovered in the four report files: the 5 equivalents on changed lines the evidence explains, and 5 on unchanged lines (`telemetry-report-display.ts:111` x3, `:122`, `:189`)
- [x] 9. Usage contract, `telemetry.md` and the `01-usage` skill say what a filter selects — `aidd_docs/product/usage-contract.md` `### Filters`, `cli/aidd_docs/memory/telemetry.md:60`, `frame.md` step 3, `references/envelope.md` `filters`
- [x] 10. `pnpm smoke` and the tokens end to end, both modes, pass with one filtered report — `evidence.md` Gates, recorded with source unchanged since (only `evidence.md` moved after); `node --test scripts/__tests__/check-claude-tokens-end-to-end.test.js` rerun: `pass 13`, `fail 0`

### Findings

- `plugins/aidd-telemetry/skills/01-usage/actions/frame.md:33` : commit `05660554` is typed `docs(telemetry)` yet changes the `01-usage` skill's behaviour (it now frames filtered questions) and adds a display unit test. Merges keep every commit (`RELEASE.md:44`) and no `feat` commit touches `plugins/aidd-telemetry`, so release-please files the skill change under Documentation with no minor bump of `aidd-telemetry` → split it into `feat(aidd-telemetry): …` for `plugins/aidd-telemetry/**`, `test(cli): …` for the display test, `docs(telemetry): …` for the rest; push with `--force-with-lease` — 🟡 major, conform
- `aidd_docs/tasks/2026_10/2026_10_15_report-filters/contract.md:48` : the code refuses a value and `--absent` on the same axis (`--model m --absent model`, exit 1), and `usage-contract.md` and `frame.md` say so; rule 2 of the contract only names the `--unattributed` pairs. The behaviour follows the rule's own reason, but the authority and the docs now disagree → add "a value and `--absent` of the same axis" to rule 2 — 🟢 minor, fit
- `cli/src/contexts/telemetry/application/report/report-usage-use-case.ts:102` : rule 2 is enforced only in the command (`telemetry.ts:271`); the use case given conflicting filters returns an empty report silently. Phase 1 planned a per-axis `ReportFilter` ("No other shape") that made a conflict unrepresentable; the flag-keyed shape traded that for a runtime check one caller remembers → have `execute` refuse when `conflictsOf(asked)` is non-empty, or record the deviation in `plan.md` Decisions — 🟢 minor, architecture
- `cli/src/contexts/telemetry/application/report/report-usage-use-case.ts:118` : `asked.repository as string | null` casts away the `{ here }` branch the line above already ruled out → narrow once, e.g. split `RequestedFilters.repository` into `here` and `typed` before resolving — 🟢 minor, standards
- `cli/src/presentation/commands/telemetry.ts:47` : a repeated bare `--unattributed --unattributed` prints `argument 'null' is invalid. Give it once.` (observed on the built binary) → name the flag without the `null` value, e.g. throw before Commander formats the preset — 🟢 minor, standards
- `cli/src/presentation/display/telemetry/telemetry-report-display.ts:63` : `selectionLine` re-walks the same three selector kinds `selectorsOf` builds in `report-filter.ts:73`, so a new selector kind must be added twice → derive the line from one exported list of `[axis, selector]` pairs — 🟢 minor, rot
- `scripts/check-claude-tokens-end-to-end.cjs:273` : the judge accepts `.` only as a 64-hex id; `repositoryIdOf` returns the 40-hex root commit for a repository with no hosted `origin` (`repository-identity.ts:45`), so a correct `.` there would be called wrong → accept `^[0-9a-f]{40}([0-9a-f]{24})?$`, or compare with the `--axis repository` key — 🟢 minor, code-health
- `plugins/aidd-telemetry/skills/01-usage/actions/answer.md:27` : no step says what `totals.records` 0 with `coverage.records` above 0 means under a filter; only `references/envelope.md` covers it → add the case to step 4, pointing to the reference — 🟢 minor, fit

### Notes

- Finding 1, release type: no history rewrite. `next` is squash-merged (`ae8705f7` has one parent), so the PR's title, `feat(telemetry): …`, is the one commit release-please reads, and it decides the release type of every path the branch touches.

## Round 2 · r-b41d

- Date: 2026-10-15
- By: Baptiste LAFOURCADE
- Diff: `ae8705f7...c790dd82`
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 10/10 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

Criteria are the contract's acceptance 1-10, the authority the plan's phase tables fold into.

### Criteria

- [x] 1. A filtered report adds up to the row it selects, `day` by its period, `total` by no filter — `report-filters.property.integration.test.ts:207`, green on rerun (`Test Files 96 passed`, `Tests 1438 passed` over `tests/contexts/telemetry`, the telemetry display, the command wiring and `tests/architecture`)
- [x] 2. Filters commute and combine with AND — same file `:230`, green
- [x] 3. Bounded and filtered equals unbounded and filtered, restricted to the period — `report-window.property.integration.test.ts`, green
- [x] 4. Every error of rules 1, 2, 3, 5, 6, 7 exits 1 naming the flag, those of 1, 2, 3, 6, 7 before anything is read — `report-usage-use-case.unit.test.ts:507` (conflict refused in the use case, before the environment's refusal, locator never asked, `events` empty); built binary in a sandbox: `--unattributed --unattributed` and `--unattributed --unattributed no-binding` → `error: --unattributed is given twice: give it once.` exit 1; `--model m --absent model`, `--absent ticket --unattributed`, and `--task a --unattributed` under `AIDD_TELEMETRY=0` → exit 1 naming both flags; empty, ambiguous and `.` outside a repository unchanged, exit 1
- [x] 5. `.` resolves to the id ingest stored — `telemetry-report.e2e.test.ts:541` green (`Tests 25 passed`); sandbox `--repository . --json` → the 64-hex id, `totals.records` 4
- [x] 6. No filter: today's envelope plus `filters` all `null` — `report-usage-use-case.unit.test.ts:349`, `report-envelope.unit.test.ts:112`, green
- [x] 7. Tests written first, red run recorded — `evidence.md` `## Review round 1`, 10 failing before the fix
- [x] 8. Telemetry mutation at 96 or above, changed-line mutants killed or explained — `evidence.md` (`score 96.3, floor 96`); `cli/reports/mutation/telemetry/mutation.json` (22:55) holds 7 survivors or uncovered in the report files: the 2 equivalents the evidence names (`report-usage-use-case.ts:168`, `report-filter.ts:92`) and 5 on unchanged display lines (`:112` x3, `:123`, `:194`)
- [x] 9. Docs say what a filter selects — unchanged from round 1, plus `answer.md:28` for a filter that matched nothing
- [x] 10. Smoke and the tokens end to end pass — smoke rerun on the `22:57` build, relocated HOME: `PASS: 132   FAIL: 0   SKIP: 1`; `node --test scripts/__tests__/check-claude-tokens-end-to-end.test.js`: `pass 14`, `fail 0`, the root-commit case included; both live modes recorded in `evidence.md` on this head

### Findings

- `plugins/aidd-telemetry/skills/01-usage/actions/frame.md:33` : round 1's major is not fixed. Commit `05660554` is still `docs(telemetry)` and still carries the skill's new framing and a display test; no commit was split or retyped. The only other commit touching `plugins/aidd-telemetry` is `c790dd82` (`fix`), so `aidd-telemetry` releases a patch, with the feature under Documentation and Bug Fixes → split `05660554` into `feat(aidd-telemetry): …` for `plugins/aidd-telemetry/**`, `test(cli): …` for the display test and `docs(telemetry): …` for the rest, and push with `--force-with-lease` — 🟡 major, conform
- `cli/src/presentation/commands/telemetry.ts:281` : the command still runs `conflictsOf` itself before `createDeps`, so the use case's own refusal never runs from the CLI, and the refusal is now worded through two call sites → drop the command's check and let the `conflicting` result exit 1, which the action already handles at `:299`; or keep it and accept the duplicate — 🟢 minor, rot
- `cli/src/contexts/telemetry/application/report/report-usage-use-case.ts:29` : `RequestedFilters` lets a caller pass `here` and a non-null `repository` together; `here` then wins and `repository` is silently dropped → make the two exclusive in the type, or refuse the pair as a conflict — 🟢 minor, standards

## Round 3 · r-e95a

- Date: 2026-10-15
- By: Baptiste LAFOURCADE
- Diff: `ae8705f7...20661e65`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 10/10 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

Criteria are the contract's acceptance 1-10. Only the command and the use case's request type changed since round 2, so 1-3 and 5-10 stand on round 2's evidence, rerun where the change reaches.

### Criteria

- [x] 1. A filtered report adds up to the row it selects — `report-filters.property.integration.test.ts:207`, green on rerun (`Test Files 42 passed`, `Tests 424 passed` over the report domain and application, the telemetry display, the command wiring and `tests/architecture`)
- [x] 2. Filters commute and combine with AND — same file `:230`, green
- [x] 3. Bounded and filtered equals unbounded and filtered, restricted to the period — `report-window.property.integration.test.ts`, green
- [x] 4. Every error exits 1 naming the flag, conflicts before anything is read — the command no longer checks conflicts (`telemetry.ts`, `conflictsOf` gone), the use case refuses them first (`report-usage-use-case.unit.test.ts`); built binary in a sandbox: `--model m --absent model`, `--absent ticket --unattributed`, `--ticket T --unattributed no-binding`, `--unattributed --task a --json`, `--repository . --task a --unattributed`, and `--task a --unattributed` under `AIDD_TELEMETRY=0` each exit 1 naming both flags, and the ledger holds no day partition after them
- [x] 5. `.` resolves to the id ingest stored — `telemetry-report.e2e.test.ts:541` green (`Tests 25 passed`); sandbox `--task auth --repository . --axis day` → `Selected: task = auth, repository = f60ecdb1`, 11 + 22 = 33
- [x] 6. No filter: today's envelope plus `filters` all `null` — `report-usage-use-case.unit.test.ts:349`, `report-envelope.unit.test.ts:112`, green
- [x] 7. Tests written first, red run recorded — `evidence.md`
- [x] 8. Telemetry mutation at 96 or above — `evidence.md` (`score 96.3, floor 96`), recorded on `c790dd82`; this round removes a duplicate check and narrows a type, adding no branch
- [x] 9. Docs say what a filter selects — unchanged since round 2
- [x] 10. Smoke and the tokens end to end pass — round 2's smoke rerun and `pass 14` stand; typecheck, `biome check` and `knip` clean on this head

### Findings

- Round 2's `telemetry.ts:281` duplicate conflict check: fixed, the use case is the one refusal.
- Round 2's `report-usage-use-case.ts:29` `here` with `repository`: fixed, `RequestedFilters` is a union in which `here` forces `repository: null`.
- Round 2's commit-type major on `05660554`: accepted by decision, not fixed. Every PR into `next` is squash-merged; the last 6 commits on `origin/next` each have one parent and carry their PR number (`fcb6022b … (#1032)`, `0a103e67 … (#1031)`, `aaca070a … (#993)`), and this PR will merge as `feat(telemetry)`, the only commit release-please reads. The branch's commit types then never reach a release.
