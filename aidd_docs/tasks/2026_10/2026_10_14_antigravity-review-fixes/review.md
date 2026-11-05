# Review: Antigravity stack review fixes

- Rounds: 1
- Started: 2026-10-14

## Round 1 · r-7c3e

- Date: 2026-10-14
- By: Thierry Kwiatkowski
- Diff: `origin/feat/511-antigravity-host...test/511-antigravity-restore` per branch (`origin/<branch>...<branch>` for each of the five; `backup/*` were rewritten by `--update-refs` and equal the fixed tips)
- Axes: code, functional, relevancy
- Verdict: changes-requested
- Score: 10/11 met, 0 unmet, 1 unverified at runtime, 0 out of the diff

### Criteria

- [x] C1 skip reason has no ticket id, pinned by test — `cli/src/contexts/tools/domain/profiles/antigravity/profile.ts:47` on the host tip, `profile.unit.test.ts:37` uses `toBe`
- [x] C2 early return replaced by a named opt-out — `registry-conformance.unit.test.ts:47,99`; emptying the set fails `is ingestible when it declares a plugins capability` (1 failed / 80 passed)
- [x] C3 `sync --force` / `clean --force` lift only the edit refusals — `remove-project-hooks.ts:59-83`; e2e `antigravity-edited-hooks.e2e.test.ts` 6/6 green on the tip, 6/6 red on `origin/feat/511-antigravity-memory-hook`; removing `force: ctx.force` (restore) or the clean guard turns the matching e2e red; plugin add/update/remove call sites pass no guard
- [x] C4 hook script recorded only in `projectHooks.scripts` — `built-tree-materialization-translator.ts:159`; reverting it fails `records a project-delivered hook script once`
- [x] C5 `translate --as flat` names `.agents/hooks.json` and leaves it untouched; no pinned agy version in `antigravity-hooks.ts:9` — `flat-build-strategy.ts:225,232`
- [x] C6 bundle figures consistent per branch — `check-bundle-size.mjs:37-40`, agents commit message; arithmetic checks (762.4-757.9=4.5, 764.2-762.4=1.8, 0.9% headroom)
- [x] C7 bracketed non-JSON-array strings quoted, JSON arrays raw — `cli/src/kernel/markdown.ts:31,62`, `markdown.unit.test.ts:153`, `portable-agent.unit.test.ts:47`
- Unverified at runtime: C8 smoke "project hooks loaded" proves the project hook against a global user hook — the only negative control ran with 0 global hooks (`0 with, 0 without`), and the baseline runs in print mode while the measured session is interactive
- [x] C9 #961 description mentions `write-rule.cjs` — `review-replies.md` #961 description edit (draft)
- [x] C10 docs precision — `05-rule-generate/references/tool-paths.md:14,16`, `11-explore/references/ai-mapping.md:7,62` agrees with `04-skill-generate/references/tool-detect.md:14`, `README.md:197`, `smoke-antigravity.sh:2-9,39-46`
- [x] C11 #962 test unchanged — `git diff origin/test/511-antigravity-restore test/511-antigravity-restore` touches no test of #962

### Findings

- `cli/scripts/smoke-antigravity.sh:93-103` : the difference check compares an interactive session's hook count with a print-mode (`-p`) baseline, and the reply claims global hooks "cancel out"; the only negative control ran on a machine with no global hook, which is the exact condition the reviewer said proves nothing → run the baseline in the same interactive pty mode, or record a run with a user-global hook present (reviewer's own setup) before claiming it — 🟡 major, fit
- `cli/src/contexts/framework/application/framework/translator/mode-b-flat-materialization-translator.ts:74` : dropping `hooksGuard` from this call leaves all 2418 framework and e2e tests green, so the `--force` threading on the no-marketplace route has no guard → add a Mode-B `--force` test (unit or e2e without a registered marketplace) that goes red on this mutation — 🟡 major, code-health
- `cli/src/contexts/framework/application/shared/remove-project-hooks.ts:45` : adding `if (overwriteEdited) return { existing };` inside the legacy branch leaves every test green; C3 names the legacy-install refusal under `--force` explicitly → add a `{ overwriteEdited: true }` case to the legacy `it.each` at `remove-project-hooks.unit.test.ts:67` — 🟡 major, code-health
- `backup/511-antigravity-{host,memory-hook,agents,docs}` : reflog shows `rewritten during rebase`; `--update-refs` moved every backup onto the fixed commits, so the pre-fix tips live only on `origin/*` and in reflog, and a force-push removes the remote copy → recreate backups from `origin/*` (e.g. `git branch -f backup/511-antigravity-host origin/feat/511-antigravity-host`) before pushing — 🟡 major, fit
- `review-replies.md` #960 table : "#957 757.9 KB, measured with tsup on the replayed stack", while the replayed host tip measures 757.8 KB → say 757.8 measured now, or label 757.9 as the figure recorded at the raise — 🟢 minor, fit
- `review-replies.md` #958 telemetry bullet and `antigravity-hooks.ts:7` : "no agy equivalent of `Stop` was measured" and "only the tool-free event is carried over", yet `08-hook-generate/references/tool-paths.md:33` states agy documents `Stop`, which is tool-free → say `Stop` is documented but unmeasured, so it is not mapped yet — 🟢 minor, rot
- `review-replies.md` #961 bullet "the header is 4 lines" : the header comment at `smoke-antigravity.sh:2-9` is 8 lines (the rewritten paragraph is 4) → say "the rationale paragraph is 4 lines" — 🟢 minor, fit
- `review-replies.md` #961 bullet "checked in a Debian container" : no recorded output in the plan folder or PR → attach the command and its output, or drop the claim — 🟢 minor, fit
- `cli/src/contexts/translate/application/strategies/flat-build-strategy.ts:232` : `assertParsableJson` duplicates `remove-project-hooks.ts:181` with the same message; translate cannot import framework → move one copy to `kernel/` and import it from both — 🟢 minor, rot
- `test/511-antigravity-restore` (#962) : now carries `docs: plan the antigravity review fixes`, a planning commit in a test PR, and the drafted #962 description does not mention it → name it in the #962 description, or move the plan commit to the docs branch — 🟢 minor, fit
