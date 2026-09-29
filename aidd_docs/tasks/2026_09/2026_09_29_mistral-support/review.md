# Review: Mistral Vibe support (retroactive record and review)

- **Verdict**: changes-requested
- **Diff**: `upstream/next...feat/mistral-support` (`15081387`), 245 files, +6914/-83. The plan says `main...HEAD`; the branch was rebuilt on `upstream/next` in phase 2, so `upstream/next` is the honest base. `main` and `upstream/next` differ only by next's own 5 commits, none touching mistral code.
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_29
- **Findings**: 1 critical, 3 warning, 2 minor

## Phases

### Phase 1 — Clean the branch and open the record

- [x] Branch pollution removed — `git ls-files | grep -E '^(review-extract|\.mistral)'` is empty at HEAD; no `.mistral/` in the worktree
- [x] Record opened — `aidd_docs/tasks/2026_09/2026_09_29_mistral-support/brainstorm.md`, `plan.md`, `phase-1.md`..`phase-5.md` all in the diff

### Phase 2 — Rebuild the branch clean, then prove it holds

- [x] Clean branch exists — `feat/mistral-support`, 4 replay commits with authors preserved, worktree clean, archive branch `vibe/mistral-support-3eed3a` untouched
- [x] Fidelity proven — `phase-2.md`: `git diff upstream/next feat/mistral-support` byte-identical to `git diff main vibe/mistral-support-3eed3a` (8931 lines each)
- [x] Test commands run and recorded — `phase-2.md` table: cli 530/532 files (one failure quoted, proven pre-existing on `next`), scripts 554/554, kanban 68/68

### Phase 3 — Reconstruct the implementation record

- [x] `brainstorm.md` carries the full narrative — 13 commits grouped into 7 delivered phases with parentage-based ordering
- [x] Debug notes referenced, not duplicated — each of the four notes linked once, root causes folded into the narrative
- [x] `Still Open` reflects real open points — stale build output, dead `hooks.json` copy, phase 2 failure triage; all present in the diff's `brainstorm.md`

### Phase 4 — Review the real diff

- [x] `review.md` written with verdict, phases, findings, file:line evidence — this file
- [x] Findings classified critical / warning / minor — Findings table below

### Phase 5 — Challenge, triage, and conclude

- [ ] `challenge.md` written, findings classified — not in this diff; phase 5 session pending (not-applicable to this phase's scope)
- [ ] Triage recorded, `plan.md` frontmatter `done`, PR open — same gap (not-applicable to this phase's scope)

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 | rot | 4 | `aidd-context/.mistral-plugin/plugin.json:1` | 158 files (+5301) of stale local build output committed at the merge, contradicting the head code: the manifest dir `.mistral-plugin/` is the pre-rebrand naming while the head emits `.vibe-plugin/` (`cli/src/contexts/tools/domain/profiles/mistral/mistral-paths.ts:27`); `aidd-context/hooks/update_memory.js` is older than the branch's own source `plugins/aidd-context/hooks/update_memory.js`; `aidd-context/skills/00-onboard/SKILL.md` carries source frontmatter (`argument-hint`, no `user-invocable`), not the Vibe shape `mistral-skill-frontmatter.ts` emits. Nothing in the repo references the root path. | `git rm -r aidd-context/`; the tree is reproducible via `aidd translate --to mistral` and its presence duplicates `plugins/aidd-context/` source. |
| 🟡 | conform | 4 | `.aidd/config.json:1` | Machine-local runtime config (telemetry off) committed to the tree while the same branch adds `.aidd/` to `.gitignore` (`.gitignore:73`); the repo convention keeps machine state out of git. | `git rm .aidd/config.json`; the new ignore line covers it once untracked. |
| 🟡 | rot | - | `cli/src/contexts/tools/domain/profiles/mistral/build.ts:38-41` | The marketplace contract ships a Claude `hooks.json` bundle (`hooks: { supported: true, hooksBundle }`) and `hooksField: true` in the synthesized manifest, while the same profile declares `acceptsHooks: false` and the flat skip reason states Vibe never loads `hooks.json` (`mistral-paths.ts:31`). Kept knowingly per `aa55ce44`, but every marketplace install receives dead files. | Drop the hooks artifact from `buildMistralContract` (and `hooksField: false`), or carry a comment stating why the dead copy stays. |
| 🟡 | code | - | `cli/src/contexts/tools/domain/profiles/mistral/profile.ts:124-129` | `rewriteContent` rewrites command references `.vibe/commands/<n>[-_]<name>/` to `.vibe/commands/<n>/`, but `buildInstallPath` (profile.ts:83-93) flattens phase dirs entirely, installing `<n>-run.md` directly under `.vibe/commands/`. Rewritten references point at a path the install never writes; the modeled pair (claude) is consistent on both sides. | Make the rewrite emit the flattened layout (drop the `/<phase>/` segment) or restore phase dirs in `buildInstallPath`; add a test binding the two together. |
| 🟢 | rot | - | `cli/src/contexts/tools/domain/profiles/mistral/build.ts:27` | `MISTRAL_PLUGIN_ROOT_TOKEN` is defined locally, while the shared vocabulary module `cli/src/contexts/tools/domain/formats/plugin-root-token.ts` exists precisely so the install and build routes cannot drift apart and holds every other tool's token. | Move the constant into `formats/plugin-root-token.ts` beside the others. |
| 🟢 | rot | - | `cli/assets/configs/mistral/settings.json:1` | Empty `{}` asset mapped to `.vibe/settings.json` (`profile.ts:48`): the install writes a file with no content and no stated intent. | Document why the placeholder exists or drop the mapping until Vibe needs real settings. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 67% (10/15) |
| Files checked | `cli/src/contexts/tools/domain/profiles/mistral/{profile,build,mistral-paths,mistral-skill-frontmatter}.ts`, `cli/src/contexts/translate/application/strategies/flat-build-strategy.ts`, `cli/src/kernel/tool.ts`, `cli/src/presentation/{commands/translate.ts,prompts/menu-use-case.ts}`, `cli/src/runtime/{assets/asset-loader.ts,wiring/tools.ts}`, `cli/assets/configs/mistral/settings.json`, `scripts/{check-markdown-links.js,check-skill-argument-hints.mjs,summarize-markdown.js}`, the 49 changed `cli/tests` files (line-by-line on the mistral-specific ones: `mistral.unit.test.ts`, `mistral-skill-frontmatter.unit.test.ts`, `flat-build-strategy.integration.test.ts`, `plugin-content-translator-skip.unit.test.ts`, `framework-build.e2e.test.ts`, `persona.e2e.test.ts`, golden snapshots audited for intent), `aidd-context/` (intent audit: manifest, hooks, 2 SKILL.md samples), `.aidd/config.json`, `.gitignore`, `.gitattributes`, `plugins/aidd-telemetry/hooks/lib/plugin-version.cjs`, `aidd_docs` task folder |
| Unchecked     | Phase 5 criteria (challenge.md, triage, plan status, PR) — not-applicable: phase 5 session pending |
| Unplanned     | none. The implementation diff (cli, scripts, plugins, golden snapshots) predates this plan and is its review subject, not an unplanned deviation; the docs commits trace to phases 1-3. The phase 2 suite evidence (one pre-existing failure at `cli/tests/contexts/telemetry/domain/formats/commit-session-trailer.integration.test.ts:72`) is outside this diff and already triaged to phase 5. |
