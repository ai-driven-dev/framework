# Review: Who is measured is chosen at opt-in

- Rounds: 2
- Started: 2026-10-15

## Round 1 · r-7c3e

- Date: 2026-10-15
- By: Baptiste LAFOURCADE
- Diff: `origin/next...1cbde1d2`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 7/7 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Every row of the Surface and Rules tables has a test, written first and seen failing — `evidence.md` red runs (phase 1: 6 failed, phase 2: 17 failed, e2e: 23 failed); rows green before the change (rule 4 refused-writes-nothing, rule 5 no git read) proven by recorded mutations; rule 6 by the existing `identity` tests; reran `cli/tests/contexts/telemetry/application/switch/telemetry-switch-use-cases.unit.test.ts`, `cli/tests/presentation/commands/telemetry-wiring.integration.test.ts:309-433`, `cli/tests/e2e/telemetry-lifecycle.e2e.test.ts:110-160` and 51 other files on 1cbde1d2: 54 files / 497 tests and 5 e2e files / 61 tests passed
- [x] A refused `on` writes neither consent nor identity, whatever the flags — `cli/src/contexts/telemetry/application/switch/telemetry-on-use-case.ts:91-105` (refusals before `readCloneConsent`, write after `grant`), tests `telemetry-switch-use-cases.unit.test.ts:459,471,481,493`; sandboxed binary: outside a repo with `--as Bob`, `--anonymous` with an identity set, blank typed id: consent `<none>`, `identity.json` unchanged
- [x] No identity is ever written without `--as`, a typed id, or the proposal chosen — `telemetry-on-use-case.ts:105` (`chosen !== null` only from `{ set }`), `telemetry-wiring.integration.test.ts:385-433`; mutation of the write guard recorded in `evidence.md` (2 tests red); sandboxed pty run: proposal, typed, anonymous each wrote exactly what was chosen, anonymous wrote nothing
- [x] The envelope is byte-identical to before for every axis — no envelope test touched by the diff; `cli/src/presentation/display/telemetry/telemetry-report-display.ts:27` changes the text label only; `report-envelope.ts` not in the diff; `cli/tests/e2e/telemetry-report.e2e.test.ts:481-486` asserts the JSON row stays `absent`; sandboxed binary with one seeded call: text row `anonymous`, JSON row `{"kind":"absent","key":null}`, after `identity "Ada Example"` `{"kind":"value","key":"Ada Example"}`
- [x] Telemetry mutation at 96 or above, every changed-line mutant killed or explained — `evidence.md` records 96.2; `cli/reports/mutation/telemetry/mutation.json` (22:23) is newer than the last `cli/src` change (21:31), and intersecting its `Survived`/`NoCoverage` mutants with the diff's added lines in the 6 changed files it covers gives none; not rerun
- [x] `pnpm smoke`, `scripts/check-claude-tokens-end-to-end.cjs` both modes pass — rerun sandboxed on 1cbde1d2: smoke `PASS: 132 FAIL: 0 SKIP: 1`, check script `2 calls, 393 tokens, all on task demo, ticket T-1` (exit 0), `--attended` `… asked, answered by the hook, kept across /clear`
- [x] Docs and the `00-init` skill say what `on` asks and how to answer it non-interactively — `plugins/aidd-telemetry/README.md:28,36,54`, `plugins/aidd-telemetry/skills/00-init/actions/start.md:22-29`, `aidd_docs/product/usage-contract.md:284-298`, `cli/aidd_docs/memory/telemetry.md:60`

### Findings

- `aidd_docs/tasks/2026_10/2026_10_15_identity-at-opt-in/contract.md:39` : rule 5 says `AIDD_TELEMETRY=0` "refuses as today", but `on` never refused under it (no `AIDD_TELEMETRY` in `application/switch/` on `origin/next`), and the code now asserts the opposite (`cli/tests/e2e/telemetry-lifecycle.e2e.test.ts:154`); rule 6 says `identity` is unchanged while its output now reads `anonymous` (`cli/src/presentation/display/telemetry-display.ts:163,167`). The contract is the authority and its decisions were the user's; neither deviation is recorded in it or in `evidence.md` → amend rules 5 and 6 to what ships (no refusal, no git read under `AIDD_TELEMETRY=0`; `identity` wording aligned on `anonymous`) and get the user's acknowledgement. The code meets rule 5 as literally written (same outcome as before, git not asked) and rule 6's wording follows decision 1, so the flaw is the contract's wording, not the work — 🟢 minor, fit
- `plugins/aidd-telemetry/skills/00-init/actions/start.md:28` : the probe at `SKILL.md:35` (unchanged line) `aidd telemetry --help` passes on a CLI too old for `--as`/`--anonymous` (CLI 5.4.0 has `telemetry on`), so this plugin on that CLI fails at `on --yes --as` with Commander's `unknown option '--as'` and, per the skill's own last rule, stops without telling the person to update `@ai-driven-dev/cli` → probe `aidd telemetry on --help` and require `--anonymous` in it before any action. Pre-existing: on `origin/next` the skill ran bare `on --yes`, which CLI 5.4.0 runs as its old git-tracked switch, so this branch turns a silent wrong write into a loud refusal — 🟢 minor, fit
- `cli/src/presentation/commands/telemetry.ts:87` : the refusal text is a copy of `REFUSALS["invalid-identity"]` in `cli/src/presentation/display/telemetry/telemetry-lifecycle-display.ts:25` → print it through `printOnResult(output, { status: "refused", reason: "invalid-identity" })` or one shared constant — 🟢 minor, rot
- `cli/src/presentation/display/telemetry/telemetry-lifecycle-display.ts:25` : a blank `--as "   "` or a blank typed answer gets "An identity is one line of at most 128 characters", which a blank line satisfies → say "one non-empty line of at most 128 characters" (also the prompt at `cli/src/presentation/commands/telemetry.ts:66`) — 🟢 minor, standards
- `cli/src/presentation/commands/telemetry.ts:66` : an invalid typed identifier is only caught by the use case, after the person confirmed the opt-in and answered the question, so the whole `on` exits 1 and must be rerun → re-ask until `personIdOf` accepts the answer (a loop here, no port change), keeping the use case check as the guard — 🟢 minor, error-handling
- `plugins/aidd-telemetry/skills/00-init/actions/start.md:25` : the skill derives its own proposal with `git config user.name`, without the CLI's filters (rejected by `personIdOf`, none under `AIDD_TELEMETRY=0`), so it can offer a name the CLI would refuse or never offer; and line 28 does not say to quote `<id>` for the shell → offer only a name of one line and at most 128 characters, and run `--as '<id>'` quoted — 🟢 minor, fit
- `plugins/aidd-telemetry/skills/00-init/SKILL.md:39` : the rewritten rule has the agent run `git config user.name` itself, so the name enters the session transcript on disk and the model's context before the person chooses, while `on` only shows it on the terminal. The contract's Docs section sanctions offering it, so this is the user's call → keep, or let the CLI resolve the proposal itself (e.g. `on --yes --as-git-name`) so the name never enters the transcript — 🟢 minor, fit
- `cli/src/contexts/telemetry/application/identity/propose-identity-use-case.ts:12` : under `AIDD_TELEMETRY=0` the proposal is withheld but the question is still asked and `on` succeeds, so the environment's refusal changes only which choices appear → keep it (conservative), but state it in the amended contract rule 5 — 🟢 minor, fit
- `plugins/aidd-telemetry/skills/00-init/actions/start.md:44` : the generic "The person says yes" row overlaps the two new rows at lines 42-43 (both assert which `on` ran) → keep only its consent and `.aidd/config.json` checks — 🟢 minor, rot

## Round 2 · r-b41d

- Date: 2026-10-16
- By: Baptiste LAFOURCADE
- Diff: `origin/next...a770739d`
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 7/7 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Every row of the Surface and Rules tables has a test, written first and seen failing — `evidence.md` "Review round 1 fixes" red run (5 failed) and guard (removing the re-ask check fails `asks again until the identifier typed is one it can keep`); amended rules 5 and 6 (`contract.md:39-40`) covered by `cli/tests/e2e/telemetry-lifecycle.e2e.test.ts:154` and `cli/tests/presentation/display/telemetry-display.unit.test.ts:38`; reran sandboxed on a770739d: `tests/contexts/telemetry`, `tests/presentation`, `tests/architecture`, `tests/golden` 140 files / 1931 tests passed, 5 telemetry e2e files / 61 tests passed; `pnpm typecheck` exit 0, biome clean on the changed files
- [x] A refused `on` writes neither consent nor identity, whatever the flags — unchanged `telemetry-on-use-case.ts`; sandboxed binary: `on --yes --as "   "` exits 1 with the `printOnResult` refusal, nothing written
- [x] No identity is ever written without `--as`, a typed id, or the proposal chosen — `cli/src/presentation/commands/telemetry.ts:66-69` returns only a typed value `personIdOf` accepts; sandboxed pty run: blank typed, asked again, `Ada at Work` typed, `identity.json` = `{"person_id":"Ada at Work"}`
- [x] The envelope is byte-identical to before for every axis — round 2 touches no report or envelope file
- [x] Telemetry mutation at 96 or above, every changed-line mutant killed or explained — rerun on a770739d, sandboxed: `Report: reports/mutation/telemetry/ (score 96.2, floor 96)`; no `Survived`/`NoCoverage` mutant on a line the branch added
- [x] `pnpm smoke`, `scripts/check-claude-tokens-end-to-end.cjs` both modes pass — `evidence.md` "Review round 1 fixes" gates on the final code; round 2 changes no path either script exercises beyond the refusal text, which smoke does not assert
- [x] Docs and the `00-init` skill say what `on` asks and how to answer it non-interactively — `plugins/aidd-telemetry/skills/00-init/actions/start.md:25-30` (type an identifier or stay anonymous, `--as '<id>'` quoted, terminal `on` offers the git name), `SKILL.md:35` probe requires `--anonymous` in `aidd telemetry on --help` (sandboxed binary: present; CLI 5.4.0's `on` has only `--yes`), `contract.md:63` Docs section matches

### Findings

- `cli/src/presentation/commands/telemetry.ts:66-69` : a refused typed identifier is asked again with the same prompt and no word on why, so a person who typed 129 characters sees the question repeat silently → print the `invalid-identity` refusal (without "Nothing was changed.") before re-asking — 🟢 minor, error-handling
- `plugins/aidd-telemetry/skills/00-init/actions/start.md:28` : `--as '<id>'` single-quoted breaks on an identifier holding `'` (`O'Brien`) → say "quoted for the shell, escaping any quote it holds" — 🟢 minor, fit
- `aidd_docs/tasks/2026_10/2026_10_15_identity-at-opt-in/review.md` "Deviations recorded" : a section outside the shape `review-validator.yml` declares (rounds hold only Criteria and Findings), restating what `contract.md:39-40,63` now holds → drop it, the contract is the canonical record — 🟢 minor, rot
- All three fixed in `39afc591`.
