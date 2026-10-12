# Verification: pre-write rule assessment

Issue [#791](https://github.com/ai-driven-dev/framework/issues/791); current base `ce80635221266dd7529d0bdc4fa98d15b9ddeb6c`.

## Concision

Following Alex’s [#981](https://github.com/ai-driven-dev/framework/pull/981) and [#950](https://github.com/ai-driven-dev/framework/pull/950): seven runtime Markdown files, 3,480 → 1,768 whitespace-delimited words (−49%). Assessment: 597 → 236. The unchanged 43-word template is excluded from both totals. Flow belongs to the router; each action or reference owns its constraints.

## Evidence

[Concise replay](receipts/concise-native.json) records final-source hashes, prompts, answers, fixture data and project snapshots. Codex 0.162.1 used ChatGPT login with API keys unset: 27 successful calls across 17 sessions.

- Fifteen fresh assessments stop without changing project bytes: new, covered, overlap, conflict, disjoint, uncertain meaning/scope, edited rendering, plugin source, Copilot guidance/import, Claude local guidance, OpenCode V1 configured instructions/fallback, and actual CLI flat Codex distribution.
- Nine-turn lifecycle: reassess changed body, require subsequent approval, publish exact body to five hosts, covered/keep, conflict/cancel, byte-identical republish, delete. Existing deletion behavior retains empty AGENTS.md.
- Three-turn merge: reassess the changed resolution, require subsequent approval, update the selected source with the exact merged body; no duplicate source.

Root regression command: `node scripts/check-tests-leave-git-alone.js -- node --test 'scripts/__tests__/**/*.test.js'`: 681 passed, zero failures/skips. Focused checks: 107 passed, including 61 writer tests. CLI flat Codex and Claude marketplace translations preserve action, reference, template and writer bytes. Writer and CLI have no diff against the current base.

## Limits

Semantic comparison remains model judgment. Approval is a skill instruction, not a script lock. Native replay uses Codex; publication to five hosts does not prove their native runtime consumption. Official discovery sources are linked in `plan.md` and the skill’s tool-path reference. Historical receipts retain their earlier source/runtime hashes and are not evidence for the shortened version.

Independent verdict: [review](review.md), [challenge](challenge.md). Disposable fixtures remain available until that check finishes; teardown is recorded separately.
