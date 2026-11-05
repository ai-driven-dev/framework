---
status: pending
---

# Instruction: The memory never blocks a legitimate write and never loses a team's line

Source: two independent challenges of this change, which reproduced every case below in a scratch project. Each finding names its repro; the fix is test first.

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/
│   ├── memory/*.md ✏️ (this repository's own bank passes its check)
│   └── tasks/2026_11/2026_11_04_lean-project-memory/
│       ├── hook-contract.md ✏️
│       └── plan.md ✏️
├── cli/aidd_docs/memory/*.md ✏️ (same)
├── cli/assets/hooks-runtime/host-*.cjs ✏️
├── docs/ARCHITECTURE.md ✏️
├── plugins/aidd-context/
│   ├── hooks/
│   │   ├── memory.cjs ✏️
│   │   └── lib/{memory-rules,common-rules,host}.cjs ✏️
│   └── skills/02-project-memory/
│       ├── actions/{02-write,03-check,04-sync}.md ✏️
│       ├── references/memory-rules.md ✏️
│       └── SKILL.md ✏️
├── scripts/__tests__/ ✏️
└── scripts/skill-eval/cases.json ✏️
```

## Who does what

| Rule | After the write (hook) | Check (engine, exit 1 on error) | Skill (model) |
| --- | --- | --- | --- |
| M1 a sentence over 25 words outside a table, list item, heading, code or diagram | level 1; required at the turn end only once measured with no false positive | error | reformats it, losing nothing |
| M3 a slot copied from the template of the same name, left unfilled, fences included | level 1; required at the turn end | error | fills it or removes it |
| M4 a backticked path that names nothing on disk | level 1 | error | fixes it or asks |
| Missing always-written file | nothing | error | creates it |
| M2 a count, a date, a time word | level 1 | warning | checks it against the code; keeps it when true |
| M5 bullet or cell over 35 words, M6 file over 400 words outside code and diagrams, M7 a sentence in two files | level 1 | warning | proposes |
| Former file, misplaced file, team folder | nothing | warning | proposes, never imposes |
| A fact true against the code, what to keep | nothing | nothing | its only judgement |

After the write, every finding only informs. At the turn end, one Stop check asks once to fix the required errors on the lines the turn is proven to have changed: the whole lines of `written` not in `replaced`, net over the turn (a line changed and changed back counts for nothing), counted as a multiset, and not in the baseline when one exists. A whole-file write over an existing file without `replaced` proves nothing. An error with no line is never required; check holds it. No proof, no hold. This is the Stop rule agreed with aidd-ui, one wording for both plugins.

## Tasks to do

### `1)` Rules that never flag legitimate content

1. **M1** counts words per sentence, so hard-wrapped prose is caught and a short labelled line is not. Front matter, HTML comments opened mid-line, list continuation lines and every fence form (backtick or tilde, nested, inside a quote, four-space indented) are not prose. One fence reader serves every rule and `sync`.
2. **M3** matches only a slot that appears in the template file of the same name, inside fences too. `{{` in inline code or in a fence that is not a template slot, TODO and TBD are never flagged. When the hook cannot find the templates, the slot list is embedded at build time.
3. **M2** is a warning: a number before a plural noun, an ISO date, a time word. Its fix reads `check it against the code; keep it if true`. Never an error, never in check's exit code.
4. **M4** (`deadPaths`):
   - compares each path segment's exact name, so `src/Index.ts` fails on macOS as on Linux;
   - skips a path under a folder ignored by a `.gitignore` in that folder or a parent, for the plain forms `dir/`, `dir`, `*.ext`, `/dir`, and states the other forms as a limit;
   - skips a path inside an uninitialised submodule (`.gitmodules` entry, empty folder);
   - skips a segment holding `{`, `}`, `<`, `>` or a leading `:`, and strips `?query` and `:L<n>`.
5. **M6** counts words outside code and diagrams.
6. **M7** is a warning.
7. Levels: every finding informs after the write. M3 is required at the turn end; M1 joins it only when task 1.1 measures it with no false positive on the four real banks (this repository's root and `cli/`, gouvernail, kairos-app).

### `2)` Hook and check robustness

1. Every adapter fills `replaced` from the host's previous content when the host gives it (Claude: `tool_response.originalFile` when it is a string). A whole-file write over an existing file without it proves no changed line: its findings only inform.
2. An Edit fragment inside a line counts that whole line as touched.
3. The hook finds the project root from the written file's own path, real paths resolved, never from the working folder alone.
4. `check` exits non-zero when no bank exists under the root or a named file is missing; a symlinked root resolves.
5. Structure findings (former files, misplaced files, team folders) are computed by the engine from the capability table and printed by `check` as warnings; only a missing always-written file is an error. `03-check.md`'s structure step reads that output instead of judging it.
6. `formatFindings` prints `1 error` and `1 warning` in the singular; every test expecting the plural, aidd-ui's included, follows.

### `2b)` The turn-end check

1. The Stop state moves to the shared library (`hooks/lib/common-rules.cjs`, or a sibling held identical by `check-hook-rule-copies.js`), since memory is the second plugin with a Stop check: a per-session mark of net changed lines per file, a baseline keyed by file, rule and excerpt, written at SessionStart and at each consumed Stop, both under rule 7's folder and permissions.
2. `hooks.json` adds the Stop entry; the descriptors already map it on every host.
3. A read-only engine run (`memory.cjs check`) marks nothing.

### `3)` Sync never loses a line and never fails silently

1. A target that cannot be written (read-only, missing folder) is skipped and named on stderr; the other targets still sync.
2. A block holding a line the generator would not produce is left as is and reported, never rewritten.
3. Targets are resolved with their real path; two names for one file are written once: `@` lines when the real file is reachable as `CLAUDE.md`, link lines otherwise.
4. Markers inside a fence, duplicated or malformed markers: left as is and reported.
5. CRLF files keep CRLF.
6. `aidd_docs/README.md` is copied only when absent.

### `4)` The skill and the contract

1. `references/memory-rules.md` states the table above; `02-write.md`'s Lint step fixes only errors, on the lines it wrote, and checks each warning against the code; `03-check.md`'s structure step reads the engine's output.
2. Refresh records the bank's lines before writing (`memory.cjs lines`, printed to a file in the session's scratch) and ends with `memory.cjs vanished <that file>`: every line present before and absent after, whitespace ignored, wherever it moved; a reordered or moved line reports nothing. The person restores. Nothing is restored automatically.
3. Kilo and OpenCode builds ship the engine under the skill's `hooks/`, so the "Found none" fallback is deleted.
4. `docs/ARCHITECTURE.md` and `hook-contract.md`: the Stop row and rule 7 take the wording agreed with aidd-ui (require only the errors on the lines the turn changed, net of what it replaced, and not in the baseline when one exists; never inform at Stop; errors new against the baseline in another file informed after the write that produced them, once per turn; an error with no line is never required at Stop, check holds it; no proof, no hold; baseline left by session start and each consumed Stop, keyed by file, rule and excerpt). Rule 3 states the proof rule for a whole-file write.
5. This repository's two banks pass `memory.cjs check` with exit 0, each change a reformat that keeps the fact.

### `5)` Eval cases

1. A bank holding `Indent with 2 spaces` and `Lines stay under 100 characters`: after refresh both lines are unchanged.
2. A bank stating a count the repo contradicts: the engine reports it as a warning and the refresh corrects it.
3. A project with its own `aidd_docs/README.md`: after setup it is byte-identical.
4. A `CLAUDE.md` block holding a team line: after refresh the line is still there.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | M1 per sentence measured on the four real banks: 0 hits keeps it required at the turn end, any hit keeps it at level 1, the count written in `measure.md`; each repro of the two challenge reports is a test that failed before the fix and passes after; a GitHub Actions `${{ secrets.X }}` line, `- No TODO left in code`, a path to a gitignored `dist/` file and a nested-fence block raise no error |
| 2b | a Write adding a slot then a Stop asks once; a Stop after a hand edit, after a standing error, or after a Cursor whole-file Write asks nothing; the aidd-ui copies stay identical |
| 2 | a Claude Write changing one line reports only that line; a Cursor whole-file Write never answers at level 2; `check` on an empty folder exits non-zero |
| 3 | read-only `CLAUDE.md` still syncs `AGENTS.md`; a symlinked `CLAUDE.md -> AGENTS.md` keeps a block Claude loads; a team line in the block survives SessionStart |
| 4 | `node plugins/aidd-context/hooks/memory.cjs check .` and `check cli` exit 0; `docs-do-not-lie` and every gate pass |
| 5 | the four cases pass on Haiku, 3 runs each |
