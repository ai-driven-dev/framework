# Mistral support, retroactive record and review

> **Retroactive.** The Mistral Vibe support shipped on `vibe/mistral-support-3eed3a` before this task folder existed. This record reconstructs what was built and reviews it; it is not a pre-implementation brainstorm. Phase files state which session wrote them.

## Why

Thirteen commits, 239 files (+6796/-83) landed on the branch without a task folder: no frame, no plan, no phase files, no review, while the repo's convention is `aidd_docs/tasks/YYYY_MM/YYYY_MM_DD_name/{brainstorm,plan,phase-N,review,challenge}.md`. The docs that did land were scattered debug notes, and the branch picked up pollution: review reports of an unrelated project (`garage-rents-watcher`) committed at the repository root.

## What Is Clear

- The code stays. No restart: `cli/src` moves 11 files (+327/-13), tests grow by 49 files (+810/-60), golden snapshots are updated. Conformity is restored on the docs, not by rewriting validated work.
- The record is reconstructed from the real commits, then the real diff `main...HEAD` is reviewed. Neither fabricates a plan the work never had; both are labeled retroactive.
- `f430866c` and `96f9175a` (both `feat: add Mistral support`, identical timestamps) are one feature iterated, not two features.
- The implementation narrative and the problems hit live in this file once phase 3 reconstructs it. Known problems so far are already recorded in the debug notes: CRLF frontmatter parsing (`2026_09_08_vibe-skill-description-debug.md`), pre-commit hooks (`2026_09_04_precommit-hooks-debug.md`), flat-build hooks skip (`2026_09_08_mistral-flat-hooks-skip-debug.md`).
- Session protocol: one session per phase of `plan.md`. Entry: read `plan.md`, run the first phase whose status is not `done`. Exit: fill the phase file's evidence, set its status, commit.

## Implementation record (retroactive, reconstructed by phase 3, 2026-09-29)

Reconstructed from the 13 commits of `main..vibe/mistral-support-3eed3a`. Where author and committer dates differ, both are recorded; the ordering below follows parentage, not timestamps.

### 1. First integration, Sep 3 (`f430866c`, Vibe Nuage Agent)

`feat: add Mistral support to CLI`, authored against the pre-refactor layout (`cli/src/domain/...`). Added the `mistral` tool definition (MCP, agents, skills, commands, rules, plugins), path constants on both sides (`MISTRAL_WORKSPACE_DIR` `.mistral/`, MCP at `.mcp.json`, marketplace manifest `.mistral-plugin/plugin.json`), the `mistral` build target in marketplace and flat modes (`buildMistralContract`, `buildMistralFlatContract`), registry wiring in `deps.ts`, the framework command's target list, a `settings.json` asset, and its asset-loader entry. 10 files, +292/-3.

### 2. Hook friction, Sep 4 (`50aef4c4`, `03d3031d`)

The pre-commit suite rejected the worktree, not the feature. Root causes in [2026_09_04_precommit-hooks-debug.md](../2026_09_04_precommit-hooks-debug.md): the argument-hint parser required `---\n` while the CRLF worktree had `---\r\n`; the markdown-links walker scanned `.aidd/` (1626 cached files) because `SKIPPED_DIRS` omitted it; Biome tripped on 332 worktree files whose CRLF diverged from their LF blobs. `50aef4c4` fixed the checkers. `03d3031d` fixed the same `.`-does-not-match-`\r` class in the catalog summarizer, whose `parseFrontmatter` had silently dropped every SKILL.md `description`, and regenerated the seven `plugins/*/CATALOG.md` files.

### 3. The feature iterated, Sep 4 (`96f9175a`)

Same subject and author date as `f430866c`; parentage (`f430866c` -> `50aef4c4` -> `96f9175a`) and committer date (Sep 4) say it was recreated on top of the hook fixes with the author date preserved. The iteration rebranded the layout onto the real Vibe shape: `.mistral/` -> `.vibe/`, `.mcp.json` -> `.vibe/mcp.json`, `.mistral-plugin/` -> `.vibe-plugin/`, lowercase `skill.md` conversion, non-Vibe frontmatter stripped to `name` and `description`, and the `tool-detect.md`/`tool-write.md` references updated. Its flat mapper wrapped every skill leaf as `<path>/skill.md`, including non-markdown assets; that mapper is the one the later EISDIR finding blames.

### 4. Test suite truth, Sep 8 (`6424d956`, `b63d864e`)

`6424d956`: a plugins-capable tool with no `MARKETPLACE_PROBES` row is invisible; test fixtures imported every AI tool except mistral, so `AI_TOOL_IDS` and registry conformance diverged from `deps.ts`. Both fixed. `b63d864e`: TTY personas need `/usr/bin/expect` (skip with the real reason when it is missing); the golden matrix runs ~100s under the parallel suite, past the 60s default. Hypotheses in the same debug note.

### 5. Truthful hook skip, Sep 8 (`aa55ce44`)

Flat builds skip `hooks/` because the mistral flat contract has no `HasHooks`. The investigation in [2026_09_08_mistral-flat-hooks-skip-debug.md](../2026_09_08_mistral-flat-hooks-skip-debug.md) confirmed the skip is format-correct: Vibe loads `.vibe/hooks.toml` (`pre_tool`/`post_tool`/`post_agent`), never Claude's `hooks.json`, and `SessionStart` has no equivalent. The generic and OpenCode skip reasons were wrong for Mistral; the contract now carries a Mistral-specific `skipReason`. The marketplace contract still copies Claude `hooks.json`, which Vibe never loads.

### 6. Flat build on a real Vibe install, investigated Sep 8, committed Sep 29 (`2536a63a`, `e5d03979`, `3e23f9b3`, `bbb4a87f`)

- EISDIR, root cause and fix in [2026_09_08_eisdir-banner-txt-debug.md](../2026_09_08_eisdir-banner-txt-debug.md): the Sep 3 mapper's `<path>/skill.md` wrap left directories on the new dest paths (an `assets/banner.txt/` directory holding the banner); `--force` then wrote through the directory and hit `EISDIR`. `e5d03979`: `checkCollision` deletes a leftover dest directory when `--force` is set; flat skills move to the generic `<plugin>-<skill>/SKILL.md` layout; a shared `mistral-skill-frontmatter` module emits `name`, `description`, `user-invocable` for both the build and the install paths.
- Vibe rejected the built SKILL.md, root cause and fix in [2026_09_08_vibe-skill-description-debug.md](../2026_09_08_vibe-skill-description-debug.md): `parseYamlLike` dropped every CRLF key, so the built file carried only `user-invocable` and a rewritten `name`, while Vibe requires `description`. `3e23f9b3`: `parseFrontmatter` splits on `/\r?\n/`, the same class of fix as `03d3031`. Rebuild verified 47/47 SKILL.md carrying `description`.
- `2536a63a` and `bbb4a87f`: lefthook's markdown-links checker skips `.vibe/` and `.gitignore` ignores it; that is the flat-build output directory.

### 7. Merge of main, Sep 29 (`f4064900`)

Brought main's contexts/kernel refactor into the branch; ~30 conflicted files resolved, relocating the mistral code to `cli/src/contexts/tools/domain/profiles/mistral/{profile,build,mistral-paths,mistral-skill-frontmatter}.ts`. The merge tree also carries two artifacts neither parent had: `aidd-context/` (158 files, a Mistral plugin-format build snapshot whose `.mistral-plugin/plugin.json` manifest comes from the pre-rebrand Sep 3 mapper and whose `hooks/update_memory.js` predates main's rewrite) and `.aidd/config.json` (telemetry disabled, local runtime config). Both are committed local build output, stale relative to the head code, which emits `.vibe-plugin/` and `.vibe/`. Recorded as facts; phase 4 reviews them.

### What remains true at the head (`feat/mistral-support`)

- Layout: workspace `.vibe/`, MCP `.vibe/mcp.json`, marketplace manifest `.vibe-plugin/plugin.json`, distribution probes on those same two paths, `settings.json` emitted to `.vibe/settings.json`.
- Capabilities: agents, skills, commands, rules, MCP, plugins; no hooks (the flat skip carries the Vibe-specific `skipReason`). Vibe frontmatter is `name` + `description` only; telemetry local read unsupported, task attribution false.
- Flat skills: `<plugin>-<skill>/SKILL.md` with `name`, `description`, `user-invocable` via the shared module; `--force` removes a leftover dest directory before writing.
- CRLF: `parseFrontmatter` splits on `/\r?\n/`; the lefthook checkers tolerate CRLF and skip `.aidd/` and `.vibe/`.
- Tests: mistral registered in fixtures and probes; the framework-build golden snapshot grows by 388 lines. Phase 2's suite run: 530/532 cli files pass, one pre-existing failure outside this branch.
- Diff vs `main` after the phase 1 record commits: 245 files, +6828/-83. `aidd-context/` alone is 5301 churn lines over 158 files; cli 1216; the rest is docs, scripts, and git/lefthook lines. The plan's 239/+6796 was measured before those commits; both are correct at their moment.

## Still Open

- Stale committed build output from the merge: `aidd-context/` (`.mistral-plugin/` naming from the pre-rebrand mapper, `update_memory.js` older than main's) and `.aidd/config.json`. Phase 1 kept them tracked; phase 4 must decide: regenerate at head, remove from the tree, or ship as-is.
- The marketplace contract's Claude `hooks.json` copy is dead for Vibe; kept knowingly in `aa55ce44`.
- Phase 2's single test failure (`commit-session-trailer.integration.test.ts:72`, `expected 2 to be 1`) is pre-existing on `next`; triaged to phase 5, not a mistral-support issue.
- Whether phase 4's review surfaces drift that justifies re-opening implementation; if so, targeted fixes or defects, not a blanket restart.

## Next Move

Run phase 4: review the real diff `upstream/next...feat/mistral-support`, with the stale build output and the dead `hooks.json` copy as named review targets.
