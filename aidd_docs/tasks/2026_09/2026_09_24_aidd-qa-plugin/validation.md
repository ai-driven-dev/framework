---
status: done
---

# Validation: aidd-qa plugin

Commands run from the repository root unless noted, with their decisive output line. Written after commits 1-3 landed, against the tree each left; commit 4 (this file, plus the rest of the task folder) follows.

## Gates (phase 4, task 1)

| # | Command | Exit | Decisive output |
| --- | --- | --- | --- |
| 1 | `pnpm exec lefthook run pre-commit` (final clean sweep, all task files staged) | 0 | `summary: (done in 48.22 seconds)` — `check-skill-argument-hints`, `cli-architecture`, `doc-duplication`, `markdown-links`, `referenced-paths`, `scripts-tests`, `summarize-plugin-catalogs`, `summarize-telemetry-prompts-doc`, `sync-readme-counts` all `✔️`; embedded `scripts-tests` run: `ℹ tests 503` / `ℹ pass 503` / `ℹ fail 0` |
| 2 | `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'` | 0 | `ℹ tests 503` / `ℹ pass 501` / `ℹ fail 0` / `ℹ skipped 2` — the 2 skips are named `hands a broken Biome rule back to the agent, naming it` and `formats a file in place and stays silent on what would not block a commit` (`# SKIP`), both pre-existing Biome-gated CLI tests, unrelated to this change |
| 3 | `pnpm test:changed` | 0 | every project block reports `ℹ fail 0`; final combined run `ℹ fail 0` |

`pre-commit`'s glob-scoped jobs (`architecture-rules`, `json-validity`, `yaml-validity`, `skill-frontmatter`) reported "no files for inspection" on the staged-file glob lefthook resolved in this checkout, so they did not execute inside that run. Ran explicitly instead: `pnpm exec lefthook run pre-commit --all-files --job architecture-rules --job json-validity --job yaml-validity --job skill-frontmatter` → exit 0, `✅ Architecture rules: 431 governed file(s) checked, no violation`, `JSON validation passed for 79 file(s).`, `YAML validation passed for 22 file(s).`, `skill-frontmatter` ✔️ with no breach printed.

Root `pnpm install` and `cd cli && pnpm install` were run first — neither `node_modules` existed in this worktree, so `js-yaml` (root) and `vitest` (`cli`) were missing and `cli-architecture` failed with `vitest: command not found` (exit 127) until installed. Not a regression from this change; recorded because it would otherwise have looked like an empty-gate false pass.

One scripts-suite regression was found and fixed as part of this change: `scripts/__tests__/architecture-rules.test.js` pins `skillsWithActions` to the number of skills with an `actions/` dir, swept from the real `plugins/` tree. Adding `aidd-qa:01-acceptance-qa` raises that from 48 to 49; the assertion was updated to `49` (test intent unchanged — it still fails if a sweep silently misses a skill).

## Host proof (phase 4, task 2)

| # | Command | Exit | Decisive output |
| --- | --- | --- | --- |
| 1 | `claude plugin validate plugins/aidd-qa` | 0 | `✔ Validation passed` |
| 2 | `claude plugin validate plugins/aidd-dev` | 0 | `✔ Validation passed` (redirect skill included) |
| 3 | `claude plugin validate .` | 0 | `✔ Validation passed` (marketplace root, 9 plugins) |
| 4 | `cd cli && pnpm install && pnpm build` | 0 | `Bundle size: 727.1 KB / budget: 734 KB` / `OK: within budget` |
| 5 | `node cli/dist/cli.js translate --help` | 0 | `--to <target> Conversion target (claude, cursor, copilot, codex, opencode, kilo)` |
| 6 | `node cli/dist/cli.js translate . --to codex --out <scratchpad>/translate-codex --as marketplace` | 0 | `Built 9 plugins, 477 files written to <scratchpad>/translate-codex` |

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

| # | SHA | Subject |
| --- | --- | --- |
| 1 | `3ef728a7` | `feat(aidd-qa): scaffold acceptance QA plugin from browser QA` |
| 2 | `ffb9c9c5` | `feat(aidd-dev): retire browser-qa to a redirect` |
| 3 | `50c13400` | `chore(marketplace): register aidd-qa plugin` |
| 4 | (this commit) | `docs(aidd-qa): add the plan and its validation record` |

Each commit's hook run is the gate evidence for that exact tree: `git show --stat <sha>` lists only the files the commit's own diff plus the hook's own generated-file side effects (`plugins/*/CATALOG.md`, README.md's counts block) touch — both regenerated from the working tree, which already held the final content at commit 1, so `plugins/aidd-dev/CATALOG.md` in commit 1 already describes the redirect landed in commit 2. This is a known, accepted side effect of `summarize-plugin-catalogs` scanning the live tree rather than the commit's own staged diff; it does not change what either commit's own hand-authored content says. Commit 1's and 2's intermediate trees are therefore not independently "architecture-doc-matches-the-tree"-clean (commit 1 alone has 9 plugin directories but an 8-row concerns table; commit 2 alone still has no marketplace entry for `aidd-qa`) — the commits were not restructured to fix this because the final tree (after commit 3) is what every gate in this file was run against, and splitting further would recreate the exact CATALOG-drift problem in a different place.

## Deviations from the plan

- Updated `scripts/__tests__/architecture-rules.test.js`'s pinned `skillsWithActions` count (48 → 49) — not named in any phase file, required because the suite hardcodes a measured count that a new skill-with-actions legitimately changes.
- Updated `docs/MAINTAINERS.md`'s package count line (`10 packages (root + 8 plugins + cli)` → `11 packages (root + 9 plugins + cli)`) — not named in phase-3, but it is the same fact `deployment.md` states and would otherwise go stale.
- `plugins/aidd-qa/README.md` and `docs/CATALOG.md`'s new `aidd-qa` section do not use the `[N.x]` "Bracket ID" numbering the curated plugins use: `aidd-telemetry`, the other off-curated-path plugin, never adopted that convention either (confirmed by grep — no `[8.x]` rows exist in its README), so `aidd-qa` follows the same off-curated precedent rather than inventing a `[9.x]` series nobody else has used since telemetry landed.
- Root `README.md`'s "Plugins" intro changed from "install all of them" to "install the six stable ones", and the Claude Code install line's off-curated parenthetical grew a third name (`aidd-qa`). The plan asked only for a new tile and corrected counts; this wording change was made because "install all of them" was already inaccurate before this change (it excluded `aidd-ui` and `aidd-telemetry`, both already off the curated path) and adding a third off-curated plugin made the inaccuracy harder to ignore. Flagging it as a judgment call beyond the plan's literal scope rather than reverting it silently.
