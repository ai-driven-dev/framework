# Task [precommit-hooks-debug]

Cherry-pick commit blocked by three pre-commit hooks. Hypotheses validated 2026-09-04.

## Hypotheses

- [x] H1 `argumentHint` requires `---\n`; worktree SKILL.md is `---\r\n` so hint is dropped. VALIDATED: onboard starts with CRLF; HEAD blob is LF and has `argument-hint: project`.
- [x] H2 Skills actually lack `argument-hint`. INVALIDATED: field present in all 47 `plugins/**/SKILL.md`.
- [x] H3 `cli-biome` fails on the staged Mistral files. INVALIDATED: those 4 files are LF; `biome check` on them is clean.
- [x] H4 `cli-biome` fails because 332 CLI worktree files are CRLF vs LF blobs. VALIDATED: `cli/src/domain/tools/ai/claude.ts` worktree CRLF, index/HEAD LF.
- [x] H5 `markdown-links` walks `.aidd/` (1626 md files); `SKIPPED_DIRS` omits it; gitignore only has `.aidd/cache/`. VALIDATED: log lines are `.aidd/plugin-cache/...`; walker uses filesystem not git ls-files.

## Outcome (2026-09-04)

Shipped in `50aef4c` (`fix(lefthook): tolerate CRLF and skip .aidd in checkers`), then cherry-pick `96f9175`. All three hooks green on the Vibe commit.

## Catalog descriptions (follow-up)

- [x] C1 `parseFrontmatter` treats `---\r` as no frontmatter, so `description` never enters `allKeys` and the column is dropped. VALIDATED: worktree SKILL.md is CRLF; `lines[0] === "---"` is false; hook uses `--fields=description`.
- [x] C2 Hook lost `--fields=description`. INVALIDATED: lefthook.yml still passes it.
- [x] C3 Catalogs were edited by hand in 50aef4c. INVALIDATED: `git add "${plugin}CATALOG.md"` in summarize-plugin-catalogs.
- [x] C4 Source SKILL.md had no description. INVALIDATED: field present; pre-commit catalog quoted the full description on SKILL.md rows.
- [x] C5 Action/asset rows lost unique prose. INVALIDATED: those cells were already `-`.

Shipped in `03d3031`. Catalogs match `50aef4c^`.

## Pre-push test failures (2026-09-04)

- [x] T1 `mistral` is in `AI_TOOL_IDS` but test fixtures never `import`/`registerTool` it. VALIDATED: `build-unit-deps.ts` and `registry-conformance.unit.test.ts` list every AI tool except mistral; `deps.ts` does register it.
- [x] T2 `VALID_TOOL_IDS` assertions still encode the pre-mistral list. VALIDATED: `tool-config.unit.test.ts:29` and `:55`.
- [x] T3 Registering mistral is enough for all 7 unit failures. INVALIDATED: mistral declares `plugins`; `MARKETPLACE_PROBES` has no mistral row (`PluginFormat` omits it). Conformance will fail next.
- [x] T4 E2E persona 1/5 fail because `dist/cli.js` is missing. INVALIDATED: `cli/dist/cli.js` exists.
- [x] T5 E2E persona 1/5 fail because `/usr/bin/expect` is missing. VALIDATED: `EXPECT_MISSING`; `execFile` code is the string `ENOENT`; personas that use `runCli()` passed.
