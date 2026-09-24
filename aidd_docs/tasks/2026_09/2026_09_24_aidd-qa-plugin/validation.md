---
status: done
---

# Validation: aidd-qa plugin

Commands run from the repository root unless noted, with their decisive output line. The original "Gates", "Host proof", and "Architecture conformance" tables below were all run against that implementation's own final working tree, before it was split into its first five commits — not re-run per commit. Each commit's own `pre-commit` hook run exited 0 (a non-zero exit would have aborted the commit), but that hook reads the working tree at commit time, not a diff scoped to that commit's own files; see "Commits" below for what that means for the two intermediate trees. "Repair re-run", further down, records a separate, later run against this repair's own final tree — read its own heading for which tree it covers, not this paragraph.

Review #908 found five defects after the push recorded in the original "Push" section: a missing run-verdict rule in `03-run-scenarios.md`, a `load-scope` that never stopped early when no criterion is browser-observable, a duplicate `## Test` bullet, two hand-written docs still describing `06-test` as generic test coverage after `ba2a59a5` narrowed it, and this record's own commit table and push section going stale as later commits (`ba2a59a5`, `e8d3538e`, `cff70e66`) landed without an update. Fixing the second defect had a second-pass bug: the first attempt at a `load-scope`-skips-`prerequisites` rule left the router's own action order (`00-prerequisites` before `01-load-scope`) unchanged, so the rule was aspirational rather than true; a second pass moved the criteria check ahead of `00` in `SKILL.md` itself. The docs-wording fix for defect four also had a first-pass bug: it copied this task's own writing constraint ("no sibling-plugin address") into the README and CATALOG rows as if it described the skill, corrected once caught. Both are visible as separate commits below rather than folded into the commits that introduced them, since those commits were already pushed.

## Gates (phase 4, task 1)

| # | Command | Exit | Decisive output |
| --- | --- | --- | --- |
| 1 | `pnpm exec lefthook run pre-commit` (final clean sweep, all task files staged) | 0 | `summary: (done in 48.22 seconds)` — `check-skill-argument-hints`, `cli-architecture`, `doc-duplication`, `markdown-links`, `referenced-paths`, `scripts-tests`, `summarize-plugin-catalogs`, `summarize-telemetry-prompts-doc`, `sync-readme-counts` all `✔️`; embedded `scripts-tests` run: `ℹ tests 503` / `ℹ pass 503` / `ℹ fail 0` |
| 2 | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | 0 | `ℹ tests 503` / `ℹ pass 501` / `ℹ fail 0` / `ℹ skipped 2` — the 2 skips are named `hands a broken Biome rule back to the agent, naming it` and `formats a file in place and stays silent on what would not block a commit` (`# SKIP`), both pre-existing Biome-gated CLI tests, unrelated to this change |
| 3 | `pnpm test:changed` | 0 | every project block reports `ℹ fail 0`; final combined run `ℹ fail 0` |

`pre-commit`'s glob-scoped jobs (`architecture-rules`, `json-validity`, `yaml-validity`, `skill-frontmatter`) reported "no files for inspection" on the staged-file glob lefthook resolved in this checkout, so they did not execute inside that run. Ran explicitly instead: `pnpm exec lefthook run pre-commit --all-files --job architecture-rules --job json-validity --job yaml-validity --job skill-frontmatter` → exit 0, `✅ Architecture rules: 431 governed file(s) checked, no violation`, `JSON validation passed for 79 file(s).`, `YAML validation passed for 22 file(s).`, `skill-frontmatter` ✔️ with no breach printed.

Root `pnpm install` and `cd cli && pnpm install` were run first — neither `node_modules` existed in this worktree, so `js-yaml` (root) and `vitest` (`cli`) were missing and `cli-architecture` failed with `vitest: command not found` (exit 127) until installed. Not a regression from this change; recorded because it would otherwise have looked like an empty-gate false pass.

One scripts-suite regression was found and fixed as part of this change: `scripts/__tests__/architecture-rules.test.js` pins `skillsWithActions` to the number of skills with an `actions/` dir, swept from the real `plugins/` tree. Adding `aidd-qa:01-acceptance-qa` raises that from 48 to 49; the assertion was updated to `49` (test intent unchanged — it still fails if a sweep silently misses a skill).

### Repair re-run (review #908 follow-up)

Each command below was run with its exit code captured directly (`cmd > log 2>&1; echo EXIT=$?`), not through a wrapper that could mask it. This is the last of two re-runs during this repair; the first (after the three initial fixes, before the `SKILL.md` routing and docs-wording corrections) produced the same decisive numbers, so only this final one, against this repair's actual final tree (`docs/CATALOG.md`, `plugins/aidd-dev/README.md`, and `plugins/aidd-qa/skills/01-acceptance-qa/{SKILL.md,actions/01-load-scope.md,actions/03-run-scenarios.md}` staged together), is recorded:

| # | Command | Exit | Decisive output |
| --- | --- | --- | --- |
| 1 | `pnpm exec lefthook run pre-commit` | 0 | `summary: (done in 48.73 seconds)` — `check-skill-argument-hints`, `doc-duplication`, `markdown-links`, `referenced-paths`, `scripts-tests`, `summarize-plugin-catalogs`, `summarize-telemetry-prompts-doc`, `sync-readme-counts` all `✔️`; embedded `scripts-tests` run: `ℹ tests 503` / `ℹ pass 503` / `ℹ fail 0` / `ℹ skipped 0` |
| 2 | `node scripts/check-architecture-rules.js` (no args, whole governed tree) | 0 | `✅ Architecture rules: 352 governed file(s) checked, no violation` |
| 3 | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | 0 | `ℹ tests 503` / `ℹ suites 22` / `ℹ pass 503` / `ℹ fail 0` / `ℹ skipped 0` |
| 4 | `claude plugin validate plugins/aidd-qa` | 0 | `✔ Validation passed` |

Both scripts-suite entries in this re-run agree on one number, 503 tests / 503 pass / 0 fail / 0 skipped — the earlier 503-pass-vs-501-pass-plus-2-skip split recorded above (gates 1 and 2, phase 4) no longer reproduces on this tree. `architecture-rules`, `json-validity`, `skill-frontmatter`, and `yaml-validity` again reported "no files for inspection" against lefthook's staged-file glob in this checkout, the same quirk noted above; `check-architecture-rules.js` was run explicitly instead, as this task's dispatch required, rather than via `--all-files --job`. `summarize-plugin-catalogs` and `sync-readme-counts` ran but changed nothing — `git status` after each pre-commit run showed no file beyond the ones already staged.

### Second repair re-run (review #908, second follow-up)

Commands below were run with their exit code captured directly (`cmd > log 2>&1; echo EXIT=$?`), against this round's tree with commit 15 (`SKILL.md`, `01-load-scope.md`, `02-prepare-run.md`, `03-run-scenarios.md`, `qa-report-template.md`) already landed and this file staged alone for commit 16:

| # | Command | Exit | Decisive output |
| --- | --- | --- | --- |
| 1 | `pnpm exec lefthook run pre-commit` | 0 | `summary: (done in 3.27 seconds)` — `doc-duplication`, `markdown-links`, `referenced-paths`, `summarize-plugin-catalogs`, `summarize-telemetry-prompts-doc`, `sync-readme-counts` all `✔️`; `architecture-rules`, `check-skill-argument-hints`, `json-validity`, `scripts-tests`, `skill-frontmatter`, `yaml-validity` skipped — this round's only staged file for this run is this task doc, which matches none of their globs |
| 2 | `node scripts/check-architecture-rules.js` (no args, whole governed tree) | 0 | `✅ Architecture rules: 352 governed file(s) checked, no violation` |
| 3 | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | 0 | `ℹ tests 503` / `ℹ suites 22` / `ℹ pass 503` / `ℹ fail 0` / `ℹ skipped 0` |
| 4 | `claude plugin validate plugins/aidd-qa` | 0 | `✔ Validation passed` |

`git status` after the pre-commit run showed no file beyond `validation.md`, already staged — `summarize-plugin-catalogs` and `sync-readme-counts` changed nothing, since commit 15 touched no `CATALOG.md`-governed surface.

## Host proof (phase 4, task 2)

| # | Command | Exit | Decisive output |
| --- | --- | --- | --- |
| 1 | `claude plugin validate plugins/aidd-qa` | 0 | `✔ Validation passed` |
| 2 | `claude plugin validate plugins/aidd-dev` | 0 | `✔ Validation passed` (redirect skill included) |
| 3 | `claude plugin validate .` | 0 | `✔ Validation passed` (marketplace root, 9 plugins) |
| 4 | `cd cli && pnpm install && pnpm build` | 0 | `Bundle size: 727.1 KB / budget: 734 KB` / `OK: within budget` |
| 5 | `node cli/dist/cli.js translate --help` | 0 | `--to <target> Conversion target (claude, cursor, copilot, codex, opencode, kilo)` |
| 6 | `node cli/dist/cli.js translate . --to codex --out <scratchpad>/translate-codex --as marketplace` | 0 | `Built 9 plugins, 477 files written to <scratchpad>/translate-codex` |
| 7 | `HOME=<scratchpad>/install-sandbox/home node cli/dist/cli.js setup --source local --path <repo> --ai claude,codex --plugins none --yes --scope project` (run from an empty `<scratchpad>/install-sandbox/project`, criterion 10) | 0 | `Installed claude, codex (2 files)` |
| 8 | `HOME=<scratchpad>/install-sandbox/home node cli/dist/cli.js plugin install aidd-qa --tool claude --scope project --yes` then the same with `--tool codex` (criterion 10) | 0 (both) | `Warning: Native plugin activation — upgrade marketplace 'aidd-framework' skipped: codex marketplace upgrade aidd-framework failed: Error: marketplace aidd-framework is not configured as a Git marketplace` then `Installed 'aidd-qa'.` (both tools; the warning is expected — the sandbox's marketplace source is local, not Git) |

Gate 8's install landed the full skill surface under both tools' caches — `find <scratchpad>/install-sandbox/home/.claude/plugins/cache/aidd-framework/aidd-qa/0.1.0/skills/01-acceptance-qa -name '*.md'` lists `SKILL.md` plus its 4 actions, 1 asset, 1 reference, matching the phase-1 projection and gate 6's Codex translate listing; `diff` against the working tree's own `SKILL.md` at commit 15's tree reported no difference, so the installed copy carries this round's Rejected-section and skip-destination fix, not a stale cached one.

Translated output confirms the full skill surface reached Codex:

```
plugins/aidd-qa/.codex-plugin/plugin.json
plugins/aidd-qa/skills/01-acceptance-qa/SKILL.md
plugins/aidd-qa/skills/01-acceptance-qa/actions/00-prerequisites.md
plugins/aidd-qa/skills/01-acceptance-qa/actions/01-load-scope.md
plugins/aidd-qa/skills/01-acceptance-qa/actions/02-prepare-run.md
plugins/aidd-qa/skills/01-acceptance-qa/actions/03-run-scenarios.md
plugins/aidd-qa/skills/01-acceptance-qa/assets/qa-report-template.md
plugins/aidd-qa/skills/01-acceptance-qa/references/interface-browser-playwright-cli.md
```

4 actions, 1 asset, 1 reference — matches the phase-1 architecture projection.

## Architecture conformance

| Command | Exit | Decisive output |
| --- | --- | --- |
| `node scripts/check-architecture-rules.js $(find plugins/*/skills plugins/*/agents -name '*.md')` | 0 | `✅ Architecture rules: 433 governed file(s) checked, no violation` |
| `node --test scripts/__tests__/architecture-doc-matches-the-tree.test.js` | 0 | `the plugin concerns table has one row per plugin in the tree` passes |
| `node --test scripts/__tests__/release-covers-every-plugin.test.js` | 0 | `build-plugin builds an archive for every plugin the marketplace lists` and `release-please versions every plugin the marketplace lists` both pass |
| `node scripts/check-doc-duplication.js` | 0 | `✅ Doc duplication: 0 duplicated sentence(s) in 48 files` |
| `node scripts/check-referenced-paths.js` | 0 | `✅ Referenced paths: 0 dead in 34 files` |
| `node scripts/check-skill-argument-hints.mjs` | 0 | `Every skill names what the user brings.` |
| `node scripts/check-markdown-links.js --ignore cli/tests/fixtures --ignore cli/aidd_docs/tasks` | 0 | `✅ Links: 0 broken in 791 files` |

`/aidd-dev:03-assert`'s `assert-architecture` facet (report-only): no macro violation — `plugins/aidd-qa/` matches the documented plugin anatomy (`.claude-plugin/plugin.json` + `skills/01-acceptance-qa/{SKILL.md, actions/, assets/, references/}`, no unused optional surfaces); no micro violation — the skill's action files carry no cross-plugin address. `assert-frontend` was skipped: this change ships markdown only, no running UI to drive.

No `aidd-<x>:<y>` token for another plugin appears in `plugins/aidd-qa/**` or `plugins/aidd-dev/skills/11-browser-qa/**`; the redirect names only the bare `aidd-qa` plugin and `/plugin install aidd-qa@aidd-framework` (no colon after `aidd-qa`, so `PLUGIN_ADDRESS` does not match it).

## Commits

All commits on this branch (`git log origin/next..HEAD`), oldest first. Rows 1-8 were pushed before the first repair started (`cff70e66` confirmed reaching `origin` at that push, original "Push" section below). Rows 9-14 are that first repair's, each carrying its real local SHA `git rev-parse --short=8 HEAD` printed right after its own `git commit`, captured into this table before the next commit ran; row 14's SHA (`3c81dfb7`) is filled in now that it is known, though the commit that first wrote this row could not yet state it. Rows 15-16 are a second round, driven by this review's follow-up findings on load-scope's skip destination, run-scenarios' verdict ordering for a rejected scenario set, and this record's own defect count and commit table; row 16, this file's own commit, cannot state its own SHA — read it off `git log` or `git ls-remote` on the pushed branch.

| # | SHA | Subject |
| --- | --- | --- |
| 1 | `3ef728a7` | `feat(aidd-qa): scaffold acceptance QA plugin from browser QA` |
| 2 | `ffb9c9c5` | `feat(aidd-dev): retire browser-qa to a redirect` |
| 3 | `50c13400` | `chore(marketplace): register aidd-qa plugin` |
| 4 | `f5c3dfcb` | `docs(aidd-qa): add the plan and its validation record` |
| 5 | `cd048e6b` | `docs(aidd-qa): correct the validation record` |
| 6 | `ba2a59a5` | `fix(aidd-dev): scope 06-test to developer-side validation` |
| 7 | `e8d3538e` | `fix(aidd-qa): restrict criteria sourcing and complete the report contract` |
| 8 | `cff70e66` | `docs: correct plugin count and the pushed validation record` |
| 9 | `89243332` | `fix(aidd-qa): add run-verdict rule and stop load-scope early` — `03-run-scenarios.md`, `01-load-scope.md`, `SKILL.md` |
| 10 | `db49deaa` | `fix(aidd-dev): describe 06-test as developer-side in its README` |
| 11 | `b642829f` | `docs: correct 06-test's catalog description and the validation record` — `docs/CATALOG.md`, this file (an earlier draft of it) |
| 12 | `911bcab5` | `fix(aidd-qa): route the zero-criterion skip before prerequisites` — `SKILL.md`, correcting the routing bug commit 9's transversal rule left in place, and correcting commit 9's own commit-body claim about where `load-scope` stops |
| 13 | `a6e0cda4` | `fix(aidd-dev): drop the addressing note from the 06-test README row` — correcting a writing-constraint phrase commit 10 copied into product-facing text |
| 14 | `3c81dfb7` | `docs: correct 06-test's catalog description and the validation record` — `docs/CATALOG.md`, this file |
| 15 | `ec1cf16f` | `fix(aidd-qa): report a fully rejected scenario set as blocked, not skipped` — `SKILL.md`, `01-load-scope.md`, `02-prepare-run.md`, `03-run-scenarios.md`, `qa-report-template.md`, correcting review #908's follow-up warning about a scenario set emptied by rejection |
| 16 | (this round's final docs commit — this record) | `docs: correct the validation record's defect count and commit table, add install proof` — this file |

`summarize-plugin-catalogs` and `sync-readme-counts` regenerate `plugins/*/CATALOG.md` and README's counts block from the live working tree, not from the commit's own staged diff — the working tree already held the final content when commit 1 ran, so `plugins/aidd-dev/CATALOG.md` in commit 1 already describes the redirect that only lands in commit 2. That is a known, accepted side effect; it does not change what either commit's hand-authored content says. It also means the two intermediate trees are not independently clean against the gates in this file:

- **At commit 1:** `plugins/aidd-dev/.claude-plugin/plugin.json` still lists `"./skills/11-browser-qa"` in `skills[]`, but that tree has no `plugins/aidd-dev/skills/11-browser-qa/` directory (it moved to `aidd-qa` in this same commit, and the redirect is not added until commit 2). `scripts/__tests__/architecture-rules.test.js`'s `skillsWithActions` sweep would read `48` on this tree, not the `49` the pinned assertion (also changed in commit 1) expects — the pin only becomes true at commit 2, once the redirect's own `actions/` directory exists. This was a mistake in how the pin's commit placement was chosen, caught only while writing this correction, not fixed by rewriting unpushed history.
- **At commit 1 and 2:** no `aidd-qa` entry exists yet in `.claude-plugin/marketplace.json`, so `release-covers-every-plugin.test.js` and `architecture-doc-matches-the-tree.test.js`'s concerns-table check would fail on those trees in isolation (9 plugin directories, 8-row concerns table / 8-plugin marketplace).

The commits were not restructured to fix this: the tree every gate in the original "Gates", "Host proof", and "Architecture conformance" tables above was actually run against is that implementation's final one (after commit 3), and splitting further would move the same CATALOG-regeneration mismatch somewhere else rather than remove it. The same applies to the first repair's own six commits (9-14): "Repair re-run" above was run once, against that repair's final tree, not per commit. The second round's own two commits (15-16) were checked the same way; see "Second repair re-run" below.

## Push

`git push -u origin feat/aidd-qa-plugin` first failed on `pnpm exec lefthook run pre-push` (glob `cli/**` — see below for why it ran), at `cli-test`, before any network call:

| Job | Result |
| --- | --- |
| `cli-knip` | ✔️ |
| `cli-test` (`pnpm --dir cli test`) | ✖ `Test Files 1 failed \| 528 passed \| 1 skipped (530)` / `Tests 1 failed \| 6794 passed \| 1 skipped (6796)`, decisive line: `tests/e2e/sandbox-reaches-no-tool-binary.e2e.test.ts:51 AssertionError: expected '' not to be ''` |

The failing assertion is `E2E: the sandbox a test spawns into > still reaches node and git, which the code under test genuinely needs`; under this test's synthetic sandboxed `PATH`, `which node` returns nothing. Isolated it and confirmed:

- Root cause, verified rather than guessed: `ls "$(dirname "$(node -p 'process.execPath')")" | grep -xE 'opencode|claude|codex|copilot|cursor-agent'` printed `codex` — this machine's `node` (via nvm) shares a `bin/` directory with a `codex` binary. `pathWithoutAidd()` in `cli/tests/e2e/helpers.ts` builds the sandbox `PATH` from `dirname(process.execPath)` among others, then runs `.filter(withoutDrivableToolBinary)`, which drops any directory holding an AI-tool binary — dropping node's own directory along with it because `codex` sits next to it. Machine-specific: `git diff c3a3355f..HEAD --stat -- cli/` is empty (none of this branch's commits touch `cli/`), and the failing test file was last changed in `95bdbbc3` (2026-09-09), weeks before this task — a pre-existing local gap, not a regression.

No workaround that bypasses or weakens the gate was used: no `--no-verify`, no excluding the job, no editing the test. Instead, the collision itself was fixed for this shell: the `node` binary was copied — not symlinked, since `process.execPath` resolves a symlink back to the original, `codex`-sharing directory — into an isolated directory holding no AI-tool binary, which was then prepended to `PATH` for the push. With that `PATH`, `pnpm exec lefthook run pre-push` passed in full (`cli-knip` ✔️, `cli-test` all passing, no failing file), and `git push -u origin feat/aidd-qa-plugin` completed without `--no-verify`. `cd048e6b` and every commit before it on this branch reached `origin` at that push; confirmed with `git ls-remote origin refs/heads/feat/aidd-qa-plugin` printing that SHA.

This record does not have first-hand detail on how `ba2a59a5`, `e8d3538e`, and `cff70e66` individually reached `origin` — they were not pushed in this session. What is directly known: the session that made this repair started with `cff70e66` already at `origin/feat/aidd-qa-plugin` (its own environment snapshot reported the branch as pushed at that SHA before any repair commit existed), and this repair's own push used the same mechanism as the one detailed above — an isolated directory holding only a copied `node` binary, prepended to `PATH` for `git push`, never `--no-verify` — because the local `node`/`codex` collision this shell sits on has not changed. That push's `pnpm exec lefthook run pre-push` ran `cli-knip` and `cli-test` again (this repair changed no file under `cli/`); its own exit code and `git ls-remote` output are the evidence, not a claim repeated here. This file does not track a single frozen "pushed tip" SHA: the branch's tip is whatever `HEAD` is when the pull request is opened, i.e. the last row of the "Commits" table above at that time. `git ls-remote origin refs/heads/feat/aidd-qa-plugin` is the way to read it, not this paragraph.

## Deviations from the plan

- Updated `scripts/__tests__/architecture-rules.test.js`'s pinned `skillsWithActions` count (48 → 49) — not named in any phase file, required because the suite hardcodes a measured count that a new skill-with-actions legitimately changes.
- Updated `docs/MAINTAINERS.md`'s package count line (`10 packages (root + 8 plugins + cli)` → `11 packages (root + 9 plugins + cli)`) — not named in phase-3, but it is the same fact `deployment.md` states and would otherwise go stale.
- `plugins/aidd-qa/README.md` and `docs/CATALOG.md`'s new `aidd-qa` section do not use the `[N.x]` "Bracket ID" numbering the curated plugins use: `aidd-telemetry`, the other off-curated-path plugin, never adopted that convention either (confirmed by grep — no `[8.x]` rows exist in its README), so `aidd-qa` follows the same off-curated precedent rather than inventing a `[9.x]` series nobody else has used since telemetry landed.
- Root `README.md`'s "Plugins" intro changed from "install all of them" to "install the six stable ones", and the Claude Code install line's off-curated parenthetical grew a third name (`aidd-qa`). The plan asked only for a new tile and corrected counts; this wording change was made because "install all of them" was already inaccurate before this change (it excluded `aidd-ui` and `aidd-telemetry`, both already off the curated path) and adding a third off-curated plugin made the inaccuracy harder to ignore. Flagging it as a judgment call beyond the plan's literal scope rather than reverting it silently.
- `/aidd-dev:02-implement` was not invoked as a skill; the phases were implemented directly and validated against each phase's own "Test acceptance criteria" table by hand. `/aidd-dev:03-assert` was invoked and its two applicable facets (`01-assert`, `02-assert-architecture`) run as reported above; `03-assert-frontend` was skipped with a stated reason.
- `phase-1.md` through `phase-4.md` are committed with their original `status: pending` frontmatter unchanged. Only `plan.md`'s `status` was set to `implemented`, per this dispatch's explicit instruction; no instruction named a phase-file status convention, and none was invented.
- `/aidd-vcs:01-commit` was invoked through the Skill tool for commit 1 only, which surfaced its `01-collect` / `02-message` / `03-commit` process. Commits 2-5 followed that same process by hand (stage the concern's files, message from the imposed text, `git commit`, verify with `git show --stat`) without re-invoking the skill each time. The review #908 repair (commits 9-14) invoked `/aidd-vcs:01-commit` through the Skill tool once for commit 9, then followed the same by-hand process for commits 10-14. The second round (commits 15-16) invoked `/aidd-vcs:01-commit` through the Skill tool for commit 15, then followed the same by-hand process for commit 16.
