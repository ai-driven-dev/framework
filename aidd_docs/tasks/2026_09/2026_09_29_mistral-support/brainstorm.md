# Mistral support, retroactive record and review

> **Retroactive.** The Mistral Vibe support shipped on `vibe/mistral-support-3eed3a` before this task folder existed. This record reconstructs what was built and reviews it; it is not a pre-implementation brainstorm. Phase files state which session wrote them.

## Why

Thirteen commits, 239 files (+6796/-83) landed on the branch with no task folder, so this record restores the repo's convention (`aidd_docs/tasks/YYYY_MM/YYYY_MM_DD_name/`). The docs that did land were scattered debug notes, and the branch carried two review reports of an unrelated project committed at the repository root.

## What Is Clear

- The code stays. No restart: `cli/src` moves 11 files (+327/-13), tests grow by 49 files (+810/-60), golden snapshots are updated. Conformity is restored on the docs, not by rewriting validated work.
- The record is reconstructed from the real commits, then the real diff is reviewed. Neither fabricates a plan the work never had; both are labeled retroactive.
- The implementation narrative and the problems hit live in this file once phase 3 reconstructs it. Known problems so far are already recorded in the debug notes: CRLF frontmatter parsing (`2026_09_08_vibe-skill-description-debug.md`), pre-commit hooks (`2026_09_04_precommit-hooks-debug.md`), flat-build hooks skip (`2026_09_08_mistral-flat-hooks-skip-debug.md`).
- Session protocol: one session per phase of `plan.md`. Entry: read `plan.md`, run the first phase whose status is not `done`. Exit: fill the phase file's evidence, set its status, commit.

## Implementation record (retroactive, reconstructed by phase 3, 2026-09-29)

Reconstructed from the 13 commits between `main` and the archive branch `vibe/mistral-support-3eed3a`. That branch was never pushed in full — origin holds only a prefix of it — so its commit hashes resolve nowhere a PR reader can reach; dates and parentage carry the narrative below, and the phase files keep the hashes as their session register. Where author and committer dates differ, both are recorded; the ordering follows parentage, not timestamps.

### 1. First integration, Sep 3 (Vibe Nuage Agent)

`feat: add Mistral support to CLI`, authored against the pre-refactor layout (`cli/src/domain/...`). Added the `mistral` tool definition (MCP, agents, skills, commands, rules, plugins), path constants on both sides (`MISTRAL_WORKSPACE_DIR` `.mistral/`, MCP at `.mcp.json`, marketplace manifest `.mistral-plugin/plugin.json`), the `mistral` build target in marketplace and flat modes (`buildMistralContract`, `buildMistralFlatContract`), registry wiring in `deps.ts`, the framework command's target list, a `settings.json` asset, and its asset-loader entry. 10 files, +292/-3.

### 2. Hook friction, Sep 4

The pre-commit suite rejected the worktree, not the feature. Root causes in [2026_09_04_precommit-hooks-debug.md](./debug/2026_09_04_precommit-hooks-debug.md): the argument-hint parser required `---\n` while the CRLF worktree had `---\r\n`; the markdown-links walker scanned `.aidd/` (1626 cached files) because `SKIPPED_DIRS` omitted it; Biome tripped on 332 worktree files whose CRLF diverged from their LF blobs. One commit fixed the checkers. The next fixed the same `.`-does-not-match-`\r` class in the catalog summarizer, whose `parseFrontmatter` had silently dropped every SKILL.md `description`, and regenerated the seven `plugins/*/CATALOG.md` files.

### 3. The feature iterated, Sep 4

Same subject and author date (Sep 3) as the first integration; its parentage — it sits on top of the hook fixes — and its committer date (Sep 4) say it was recreated on top of them with the author date preserved. The iteration rebranded the layout onto the real Vibe shape: `.mistral/` -> `.vibe/`, `.mcp.json` -> `.vibe/mcp.json`, `.mistral-plugin/` -> `.vibe-plugin/`, lowercase `skill.md` conversion, non-Vibe frontmatter stripped to `name` and `description`, and the `tool-detect.md`/`tool-write.md` references updated. Its flat mapper wrapped every skill leaf as `<path>/skill.md`, including non-markdown assets; that mapper is the one the later EISDIR finding blames.

### 4. Test suite truth, Sep 8

One commit closed a registry gap: a plugins-capable tool with no `MARKETPLACE_PROBES` row is invisible; test fixtures imported every AI tool except mistral, so `AI_TOOL_IDS` and registry conformance diverged from `deps.ts`. Both fixed. The next made the suite truthful about its environment: TTY personas need `/usr/bin/expect` (skip with the real reason when it is missing); the golden matrix runs ~100s under the parallel suite, past the 60s default. Hypotheses in the same debug note.

### 5. Truthful hook skip, Sep 8

Flat builds skip `hooks/` because the mistral flat contract has no `HasHooks`. The investigation in [2026_09_08_mistral-flat-hooks-skip-debug.md](./debug/2026_09_08_mistral-flat-hooks-skip-debug.md) confirmed the skip is format-correct: Vibe loads `.vibe/hooks.toml` (`pre_tool`/`post_tool`/`post_agent`), never Claude's `hooks.json`, and `SessionStart` has no equivalent. The generic and OpenCode skip reasons were wrong for Mistral; the contract now carries a Mistral-specific `skipReason`. The marketplace contract still copies Claude `hooks.json`, which Vibe never loads.

### 6. Flat build on a real Vibe install, investigated Sep 8, committed Sep 29

- EISDIR, root cause and fix in [2026_09_08_eisdir-banner-txt-debug.md](./debug/2026_09_08_eisdir-banner-txt-debug.md): the Sep 3 mapper's `<path>/skill.md` wrap left directories on the new dest paths (an `assets/banner.txt/` directory holding the banner); `--force` then wrote through the directory and hit `EISDIR`. The fix: `checkCollision` deletes a leftover dest directory when `--force` is set; flat skills move to the generic `<plugin>-<skill>/SKILL.md` layout; a shared `mistral-skill-frontmatter` module emits `name`, `description`, `user-invocable` for both the build and the install paths.
- Vibe rejected the built SKILL.md, root cause and fix in [2026_09_08_vibe-skill-description-debug.md](./debug/2026_09_08_vibe-skill-description-debug.md): `parseYamlLike` dropped every CRLF key, so the built file carried only `user-invocable` and a rewritten `name`, while Vibe requires `description`. The fix: `parseFrontmatter` splits on `/\r?\n/`, the same class of fix as the catalog summarizer's. Rebuild verified 47/47 SKILL.md carrying `description`.
- The remaining commits of this phase keep the flat-build output out of the way: lefthook's markdown-links checker skips `.vibe/` and `.gitignore` ignores it; that is the flat-build output directory.

### 7. Merge of main, Sep 29

Brought main's contexts/kernel refactor into the branch; ~30 conflicted files resolved, relocating the mistral code to `cli/src/contexts/tools/domain/profiles/mistral/{profile,build,mistral-paths,mistral-skill-frontmatter}.ts`. The merge tree also carries two artifacts neither parent had: `aidd-context/` (158 files, a Mistral plugin-format build snapshot whose `.mistral-plugin/plugin.json` manifest comes from the pre-rebrand Sep 3 mapper and whose `hooks/update_memory.js` predates main's rewrite) and `.aidd/config.json` (telemetry disabled, local runtime config). Both are committed local build output, stale relative to the head code, which emits `.vibe-plugin/` and `.vibe/`. Recorded as facts; phase 4 reviews them.

### What remains true at the head (`feat/mistral-support`)

State after the phase 5 triage, verified against the head:

- Layout: workspace `.vibe/`, MCP `.vibe/mcp.json`, marketplace manifest `.vibe-plugin/plugin.json`, distribution probes on those same two paths. No settings file is written: the phase-1-era `settings.json` mapping was dropped in phase 5 — Vibe reads `.vibe/config.toml`, which the framework does not synthesize.
- Capabilities: agents, skills, commands, rules, MCP, plugins; no hooks — both contracts, marketplace and flat, declare hooks unsupported with the Vibe-specific `skipReason` (the Claude `hooks.json` bundle and the manifest's hooks field were dropped in phase 5). Vibe frontmatter is `name` + `description` only; telemetry local read unsupported, task attribution false.
- Flat skills: `<plugin>-<skill>/SKILL.md` with `name`, `description`, `user-invocable` via the shared module; `--force` removes a leftover dest directory before writing.
- Build vocabulary: `MISTRAL_PLUGIN_ROOT_TOKEN` lives in `formats/plugin-root-token.ts` beside every other tool's token (moved there in phase 5; the flat capability nulls the token by design).
- CRLF: `parseFrontmatter` splits on `/\r?\n/`; the lefthook checkers tolerate CRLF and skip `.aidd/` and `.vibe/`.
- Tests: mistral registered in fixtures and probes; the framework-build golden snapshot grows by 385 lines at this head. Phase 5's suite run: 530/532 cli files pass, the single pre-existing failure filed as a defect.
- Diff vs `upstream/next` at this head: 91 files, +1826/-83, cli alone 63 files, +1130/-74. The earlier figures in this record (239/+6796 at the plan's framing, 245/+6828 after the phase 1 commits) were true at their moment; the stale `aidd-context/` snapshot (158 files) left the diff in phase 5 and resolves to nothing here.

## Still Open

Nothing in this task. Phase 5 concluded every open point:

- Stale committed build output from the merge: removed. `aidd-context/` (158 files) deleted from tree and index; nothing referenced the root path. `.aidd/config.json` untracked (kept on disk): `main`, `upstream/next`, and both merge parents track no such file; the merge resolution introduced it, and untracking aligns the branch with its base. The review's stated reason was wrong on one fact — the branch added only the `.vibe/` ignore line, `.aidd/` predates it — but the conclusion holds on the base-alignment evidence.
- The dead Claude `hooks.json` marketplace copy: dropped. The marketplace contract now declares hooks unsupported with the same Vibe skip reason as the flat contract; the golden snapshot recaptured, its mistral marketplace cell loses exactly the 3 hook files and no other cell changes.
- Phase 2's single test failure: filed upstream as `ai-driven-dev/framework#940`, git 2.39.2 sensitivity, proven pre-existing.
- Phase 4's `rewriteContent` vs `buildInstallPath` warning: superseded by a deeper finding and filed upstream as `ai-driven-dev/framework#939` — Vibe has no commands directory at all, so fixing the rewrite to point deeper into a dead surface serves nothing.
- New, from phase 5's challenge: the marketplace route emits trees Vibe cannot detect (`.vibe-plugin/plugin.json` matches no documented native or foreign marker; native manifests are `plugin.json` at the plugin root). Filed upstream as `ai-driven-dev/framework#938`. The flat route is the only install-verified path; the challenge confidence is 65% for this reason.
- The empty `.vibe/settings.json` mapping: dropped in phase 5 (Vibe reads `.vibe/config.toml`; a settings.json there was dead), and `MISTRAL_PLUGIN_ROOT_TOKEN` moved into `formats/plugin-root-token.ts` beside the other tools' tokens.

## Next Move

None. The record is concluded: draft PR [ai-driven-dev/framework#937](https://github.com/ai-driven-dev/framework/pull/937) is open against `next`, and the defects are upstream issues #938, #939, #940.
