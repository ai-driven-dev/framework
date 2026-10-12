# Verification: pre-write rule assessment

Verified on 2026-10-12 against [issue #791](https://github.com/ai-driven-dev/framework/issues/791). Base: `3e67f6f594b7b7f6cc7bceb0581ad6d515519080`.

## Behavior evidence

The old skill wrote the canonical rule and shared AGENTS contribution without the new assessment decision: [baseline receipt](receipts/baseline.json). The revised skill stopped before writing in all thirteen fresh assessment runs. Every run exited successfully and its complete project-file SHA-256 map was unchanged. Classification was checked against the actual answer, not a phrase-presence test.

[Assessment receipts](receipts/native-assessment.json) include prompts, answers, original fixture contents, before/after hashes, installed-skill hashes and raw-event hashes.

| Fixture | Observed result |
| --- | --- |
| New constants policy | New; requires approval of the complete candidate. |
| Same pytest policy, different title and wording | Covered; five verified publications represent one policy. |
| Pytest plus an additional unit-test directory requirement | Overlap; repeated and added obligations identified. |
| Pytest versus unittest in the same scope | Conflict; existing source cited. |
| Backend versus frontend test paths, with no matching files yet | New; disjoint prefixes justify excluding the existing policy. |
| Missing referenced test-framework decision | Needs review; no guessed framework. |
| Missing file-selection configuration | Needs review; no guessed scope intersection. |
| Edited Claude rendering | Canonical coverage and the conflicting native edit both remain visible. |
| Plugin-source pytest rule | Conflict detected without host publication. |
| Copilot GEMINI guidance | Conflict detected from the project instruction source. |
| Copilot repository instruction import | Imported policy read and conflict identified. |
| Claude-only local project policy | Conflict in CLAUDE.local.md detected before writes. |
| Actual CLI flat Codex distribution | Conflict detected before writing through the installed skill. |

The [nine-turn lifecycle](receipts/native-lifecycle.json) proves reassessment after a body change, no write before the subsequent approval, exact approved-body preservation, five-host publication, covered/keep and conflict/cancel without changes, byte-identical publication, and deletion. Deletion leaves an empty AGENTS.md, the existing writer behavior; it does not restore the original file inventory.

The [three-turn merge](receipts/native-merge.json) proves an existing rule can be selected for a merge, the changed complete body is reassessed without writes, and explicit approval updates that source and its publications with the exact merged body. No second canonical rule is created.

## Regression and distribution checks

- Existing writer suite: 61 passed. Focused architecture, portability, links and writer checks: 117 passed, no failures or skips.
- Full pre-commit gates: wrapped root suite `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`: 677 passed, no failures or skips. Recipe build and all three bundled recipe validations passed; catalog, link, duplication and referenced-path checks passed.
- Actual pre-push gates: Knip passed; CLI suite passed 7,002 tests across 539 test files, with one test/file skipped and no failures. The remote branch SHA matched the committed candidate.
- `git diff 3e67f6f594b7b7f6cc7bceb0581ad6d515519080 --exit-code -- plugins/aidd-context/skills/05-rule-generate/scripts/write-rule.cjs cli`: no changes. Publication, ownership and CLI behavior remain the existing implementation.
- `AIDD_SKIP_UPDATE_CHECK=1 node cli/dist/cli.js translate . --to codex --as flat --out <existing-output-directory>` and the Claude `--as marketplace` translation succeeded. Both distributions contain the four actions and unchanged writer; their four actions, two references and writer match source bytes. Old action filenames are absent. One native session used the actual flat distribution.

## Reproduction and limits

[Runtime](receipts/runtime.json): native Codex 0.154.0, ChatGPT login, disposable projects, no application edits or package installation in fixtures. API-key environment variables were unset. Initial calls used `codex -a never exec --ignore-user-config --skip-git-repo-check --sandbox workspace-write --cd <project> --json --output-last-message <answer> -`; fresh assessment calls additionally used `--ephemeral`. Persistent follow-ups used `codex -a never exec resume --ignore-user-config -c 'sandbox_mode="workspace-write"' --skip-git-repo-check --json --output-last-message <answer> <thread> -` from the fixture directory. The per-call sandbox override was necessary because resume otherwise defaulted to read-only; no user configuration was changed.

To repeat an assessment, materialize the recorded `fixtureFiles` in a disposable project, copy or translate the skill into a separate installed directory, substitute those two paths in the recorded prompt, snapshot every project file, then run the command above with that prompt on stdin. Compare complete before/after maps and inspect the answer against the fixture's policy obligations. To repeat the journeys, start a persistent session and supply the recorded follow-up prompts in order, retaining per-turn snapshots.

These receipts cover 25 successful native CLI invocations in 15 sessions: thirteen fresh assessments and two persistent journeys. Exploratory runs, the old-skill baseline and the initial read-only harness failure are excluded from this count. Earlier eight-case runs preceded the bounded discovery-reference expansion; the four workflow actions and writer are byte-identical to the final version. Later Copilot, flat-distribution, scope, merge and Claude-local cases exercise the added discovery paths. Conditional Claude AGENTS activation was checked against documentation; it was not exercised in a native Claude session. Per-session hashes preserve this distinction; [final source hashes](receipts/final-source-hashes.json) identify the final assets.

Semantic comparison is model judgment, not a deterministic conflict detector or a script-enforced approval lock. These runs exercise the skill through Codex and its five-host writer. They do not prove runtime instruction consumption by native Claude, Cursor, Copilot or OpenCode sessions. Relevant discovery contracts were checked against the official sources linked in the plan and tool-path reference. No claim of universal host precedence, full account/global discovery or coverage of every glob is made.

## Independent judgment and teardown

The [three-axis review](review.md) approves the repaired candidate with no remaining finding. The [independent outcome challenge](challenge.md) records 95% confidence and no deal breaker. Its optional follow-up is a native Claude journey covering local guidance and conditional AGENTS loading; this is carried onto the PR as a coverage limit, not claimed as completed.

The fifteen reviewed native sessions and old-skill baseline were archived locally, then their disposable fixture directories removed. [Teardown receipt](receipts/teardown.json) records archive hash and removed roots. Historical root paths in receipts identify the tested sessions; the committed fixture contents, prompts, answers and hashes remain available for reproduction. The original workspace retains its personal .gitignore change and untracked .hermes.md; neither was edited.
