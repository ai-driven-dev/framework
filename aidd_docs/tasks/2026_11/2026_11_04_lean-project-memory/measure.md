# Measure: the project-memory skill before any change

Baseline for phase 15. Same harness, cases and rubric are rerun after the change; nothing else varies.

## Fixed inputs

| Item | Value |
| ---- | ----- |
| Skill measured | `plugins/aidd-context/skills/02-project-memory` and `plugins/aidd-context/hooks` taken from `git archive` of head `1cb1643d6e4a742ec662faacdfdc4f030780fcef`, so later edits in the worktree cannot move the baseline |
| Skill size | 44 files, 7132 words in total: SKILL.md 199, 4 actions 910, 8 references 1889, 2 assets 505, 29 templates 3629 |
| Models | Claude `haiku` (resolves to `claude-haiku-5-5`), Qwen 3.8 Flash (`opencode-go/qwen3.8-flash`). Sonnet only grades |
| Harness | `~/skill-tests/lean-memory/` outside the repository: `lib.py` (runner), `prep.py` (snapshots, drift injection), `runcase.py` (setup and refresh), `cases6.py` (the 6 eval cases), `cap.py` (findings), `grade.py` (blind grader), `analyze.py`, `drifts.json` |
| Isolation | Each run is a throwaway project under `~/skill-tests/lean-memory/runs/`. The skill is copied to `.claude/skills/xeval-memory/` with its `name` rewritten, plus the plugin `hooks/` beside it, as `scripts/skill-eval` does. Claude runs `claude -p --setting-sources project,local --dangerously-skip-permissions`; Qwen runs `opencode run --pure --auto --format json`. No installed plugin or user tool config is read or written by the harness |
| Cost | Claude: `total_cost_usd` of the run's own result event. Qwen: sum of `cost` over the run's `step_finish` events |
| Words read | Distinct skill files the model opened (a `Read` or `Bash` call naming the file, plus SKILL.md when the skill tool fired), summed by their word count. A lower bound: SKILL.md arrives through the skill tool |

## Repository choices

| Role | Repository | Why |
| ---- | ---------- | --- |
| Setup A | an infrastructure repository (runner, stacks, deploy, edge: Python and shell, Compose, 382 files) | no `aidd_docs/`; a non-application shape where most capability files should stay unwritten |
| Setup B | a Node tooling and docs repository (scripts, templates, docs, commitlint, lefthook) | no `aidd_docs/`; a different shape, with real conventions to read. `.claude/`, `.agents/` and similar tool folders stripped from both so no run reads another tool's config |
| Refresh | a full-stack TypeScript repository (React, Hono, Postgres, 988 files) with an existing 17-file bank, copied from its committed head | the largest real bank that is not 25k words; drifts injected into the copy only |

Both setup repositories were taken from their committed heads and had no `aidd_docs/` directory (asserted by the harness).

## Injected drifts

| Id | Kind | Injection | Truth |
| -- | ---- | --------- | ----- |
| D1 | stale count | `codebase-map.md`: "Three workspace packages in total." | the workspace file lists four packages |
| D2 | renamed path | `codebase-map.md`: entry point `bootstrap/server.ts` | the file is `bootstrap/http.ts` |
| D3 | removed command | `vcs.md`: pre-commit runs `make lint-all` | no such Makefile target; it is `make check` |
| D4 | contradicted claim | `architecture.md`: backend is "Express on Node" | the backend depends on Hono |

Refresh prompt approves every finding that adds or corrects a fact and declines every finding that removes a line. The untouched injected bank scores 3 errors and 61 warnings in `memory-lint.cjs`.

## Blind grading

One Sonnet grader per bank, given a random id, the bank files (README and `.gitkeep` removed) and a clean copy of the repository (the refresh repository without its bank). It is not told the version, the model or the case. It extracts up to 40 verifiable claims spread across files, checks each with Read, Grep and Glob, and returns correct, wrong, unverifiable. Format errors come from `memory-lint.cjs`, run by the harness, not by the grader. A grader that reads the claims itself is a sample, not a census: counts differ per bank, so compare the wrong rate, not the raw totals.

## Setup runs (3 per repository and model)

Facts column: correct / wrong / unverifiable of claims checked. Lint column: errors / warnings of the final bank. Run folder: `~/skill-tests/lean-memory/runs/<kind>/<model>/<n>/` (project, `events.jsonl`, `meta.json`, `grade.json`).

| Case | Model | Run | Facts | Lint | Skill words read | Cost USD | Seconds |
| ---- | ----- | --- | ----- | ---- | ---------------- | -------- | ------- |
| setup-ops | haiku | 1 | 27/1/0 of 28 | 0/0 | 13 files, 3172 | 0.046 | 146 |
| setup-ops | haiku | 2 | 28/0/0 of 28 | 0/2 | 8 files, 1711 | 0.073 | 201 |
| setup-ops | haiku | 3 | 30/0/0 of 30 | 0/0 | 26 files, 5007 | 0.038 | 189 |
| setup-ops | qwen | 1 | 26/1/3 of 30 | 1/8 | 29 files, 5023 | 0.149 | 706 |
| setup-ops | qwen | 2 | 25/1/0 of 26 | 2/2 | 19 files, 4283 | 0.131 | 607 |
| setup-ops | qwen | 3 | 33/1/0 of 34 | 1/2 | 30 files, 5606 | 0.127 | 809 |
| setup-tooling | haiku | 1 | 22/2/0 of 24 | 0/0 | 13 files, 3172 | 0.042 | 135 |
| setup-tooling | haiku | 2 | 22/1/1 of 24 | 2/1 | 9 files, 1770 | 0.041 | 143 |
| setup-tooling | haiku | 3 | 24/1/1 of 26 | 0/0 | 14 files, 3317 | 0.038 | 165 |
| setup-tooling | qwen | 1 | 24/3/1 of 28 | 2/0 | 26 files, 5088 | 0.049 | 419 |
| setup-tooling | qwen | 2 | 33/0/3 of 36 | 0/0 | 17 files, 3823 | 0.055 | 574 |
| setup-tooling | qwen | 3 | 25/3/2 of 30 | 2/1 | 14 files, 3487 | 0.051 | 341 |

| Model | Correct | Wrong | Wrong rate | Lint errors per bank | Skill words read | Cost per run | Seconds per run | Engine errors |
| ----- | ------- | ----- | ---------- | -------------------- | ---------------- | ------------ | --------------- | ------------- |
| haiku | 153 | 5 | 3.1% of 160 checked | 0.33 | 3025 | 0.046 | 164 | 0 |
| qwen | 166 | 9 | 4.9% of 184 checked | 1.33 | 4552 | 0.094 | 576 | 0 |

Observations that bind the redesign:

- Both models write 9 to 15 memory files for the same repository: file count varies run to run (haiku 9 to 12, qwen 10 to 15), so a capability table is the lever, not a word count.
- Wrong facts are mostly invented specifics (a pre-commit command, a commit type, a test layout), not misreads.
- Haiku read as little as 1711 words and as much as 5007 of the 7132; the whole skill is never read.

## Refresh runs (bank with four drifts, 3 per model)

Flagged: the drift's wrong text is named in the printed summary or the report. Corrected: the injected text is gone from the bank. Lines removed: baseline lines no longer present verbatim, injected lines excluded (a reword counts). Files changed: files under `aidd_docs/memory/` that differ from the injected bank, new files included.

| Model | Run | Flagged | Corrected | Files changed | Lines removed | Lint | Facts | Skill words read | Cost USD | Seconds |
| ----- | --- | ------- | --------- | ------------- | ------------- | ---- | ----- | ---------------- | -------- | ------- |
| haiku | 1 | D1, D2, D4 | D1, D2, D4 | 2 | 1 | 3/61 | 27/1/2 of 30 | 12 files, 2939 | 0.031 | 69 |
| haiku | 2 | D2, D4 | D2, D4 | 6 | 2 | 3/61 | 16/2/2 of 20 | 10 files, 2442 | 0.041 | 125 |
| haiku | 3 | D2, D3, D4 | D2, D3, D4 | 3 | 1 | 3/61 | 17/2/1 of 20 | 12 files, 3028 | 0.035 | 86 |
| qwen | 1 | D1, D2, D3, D4 | D1, D2, D3, D4 | 19 | 36 | 3/69 | not graded | 16 files, 3333 | 0.098 | 1416 |
| qwen | 2 | D2, D3, D4 | D1, D2, D3, D4 | 19 | 29 | 4/64 | not graded | 15 files, 3255 | 0.208 | 2112 |
| qwen | 3 | D1, D2, D3, D4 | D1, D2, D3, D4 | 11 | 12 | 3/61 | not graded | 15 files, 3255 | 0.107 | 964 |

| Model | Drifts flagged | Drifts corrected | Files changed | Lines removed | Wrong facts after | Cost per run |
| ----- | -------------- | ---------------- | ------------- | ------------- | ----------------- | ------------ |
| haiku | 8 of 12 (D1 1/3, D2 3/3, D3 1/3, D4 3/3) | 8 of 12 | 2, 6, 3 | 1, 2, 1 | 1, 2, 2 of 30, 20, 20 checked | 0.036 |
| qwen | 11 of 12 (D1 2/3, D2 3/3, D3 3/3, D4 3/3) | 12 of 12 | 19, 19, 11 | 36, 29, 12 | not graded, see below | 0.138 |

Reference: the untouched injected bank graded the same way scored 5, 5 and 4 wrong claims (of 26, 24, 30 checked), which are the drifts plus claims the bank already had wrong.

Observations:

- No model deleted a bank file. Qwen rewrote 11 to 19 files and dropped 12 to 36 baseline lines although the prompt declined removals; Haiku touched 2 to 6 files and dropped 1 to 2 lines.
- Haiku missed D1 (the count) in two of three runs and D3 (the removed command) in two of three. A volatile count is the drift both models catch least often by name.
- Haiku run 2 created three capability files (`design.md`, `forms.md`, `navigation.md`) and edited `README.md`.
- Check ends by printing a report path under `aidd_docs/tasks/`; those report files are ignored in "files changed".

## The 6 eval cases (Haiku, deterministic checks only)

Cases of `scripts/skill-eval/cases.json` for `02-project-memory`, rebuilt in the harness; the `judge` criteria need a second Claude run and were not executed. Run folder: `~/skill-tests/lean-memory/runs/cases6/haiku/<index>/`.

| Index | Case | Checks passed | Failed | Cost USD |
| ----- | ---- | ------------- | ------ | -------- |
| 0 | setup writes the bank to its destinations | 21 of 21 | none | 0.022 |
| 1 | check flags an orphan file and deletes nothing | 12 of 12 | none | 0.011 |
| 2 | check flags the always file the bank lacks | 11 of 12 | stdout contains "Memory bank" | 0.008 |
| 3 | rewire fills the context block | 3 of 3 | none | 0.007 |
| 4 | an empty repo produces no bank | 2 of 2 | none | 0.006 |
| 5 | refresh applies what is approved and leaves the rest | 8 of 8 | none | 0.020 |

The index is the position among the six `02-project-memory` cases, so it differs from the file's array index by five.

## How many findings a model handles

Method: a project holds one memory file whose lint warnings are known by construction. The model is told it just wrote the file and is given the memory check's own lines for that file, then fixes it. Two kinds: `dup` (N sentences also written in another file, rule M7) and `long` (N bullets over 35 words, rule M5). Counts 3, 10, 25 as planned, plus 50 and 100 because nothing broke up to 25. Three runs per model, kind and count (60 runs). Fixed and missed come from rerunning `memory-lint.cjs` on the file afterwards. Kept: how many of the N bullets' topics are still in the file. Run folder: `~/skill-tests/lean-memory/runs/cap/<kind>-<N>/<model>/<n>/`.

| Count | Missed, both models, both kinds (runs) | Information lost: `long` runs that dropped bullets instead of splitting them (kept of N) | Output tokens per run, haiku / qwen (`long`) | Cost per run, both models |
| ----- | -------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- | -------------------------- |
| 3 | 0 of 12 | 0 of 6 | 936 / 1247 | under 0.006 |
| 10 | 0 of 12 | 0 of 6 | 1567 / 2004 | under 0.008 |
| 25 | 0 of 12 | 1 of 6 (haiku, 24 of 25 kept) | 1863 / 2526 | under 0.009 |
| 50 | 0 of 12 | 2 of 6 (one per model, 27 of 50 kept) | 2131 / 1880 | under 0.007 |
| 100 | 0 of 12 | 1 of 6 (qwen, 27 of 100 kept) | 3092 / 3440 | under 0.009 |

New findings introduced by a fix (a different finding appearing on the file): none at 3 and 10; 3 runs at 25 (one per model and kind, except qwen `long`), 5 of 6 `dup` runs at 50, 2 runs at 100 (qwen `dup`, haiku `long`). The `dup` fixes resolve a sentence either by rewording or by deleting its copy, so "kept" is not a loss there; it is reported in the run folders.

**Measured cap.** By the plan's definition (the highest count with no finding missed) no tested count misses one: 0 missed of 60 runs from 3 to 100 findings on both models, so the cap is at least 100 and the measurement does not bound it. Content loss starts at 25 and is real from 50: at 3 and 10 all 12 `long` runs kept every bullet; at 25 one run dropped one bullet; at 50 and 100 three of 12 runs rewrote the file keeping 27 bullets. A cap of 10 is the highest count with no missed finding and no loss in any run; 25 loses one bullet in one run of six. The memory hook's current limit is 5 lines, set without a measurement, and is well under what either model fixed.

Limits: the findings reach the model as a user message, not as hook feedback inside the same turn, because opencode runs no Claude hook; the findings are one rule at a time; Haiku and Qwen only.

## Spend

About 12.0 USD in total (11.99 by the runs' own outputs plus a few cents of discarded runs), at the limit. Blind grading was 10.1 of it (about 0.56 per bank, 18 banks, three of them the unchanged Qwen refresh banks), the generation runs 1.9. The three Qwen refresh banks were not graded again after their rerun, for budget.

## Blockers and stated limits

- Qwen refresh exceeded a 900 second limit on all three first attempts (banks left unchanged, now archived under `runs/_timeout900/`); rerun with a 2700 second limit it took 964, 1417 and 2112 seconds. One rerun hit an opencode "database is locked" error caused by killing the other runs and was rerun alone.
- A run edits only its own throwaway project. Haiku ran `pnpm install` inside its project in one run; `node_modules` is excluded from "files changed".
- Drift detection by text match: a drift described without its wrong text (no "Express", "server.ts", "lint-all", "Three workspace" or the real package count) counts as not flagged.
- The grader samples claims, runs once per bank and is a Sonnet model; it is stricter and costlier than the models it grades.
