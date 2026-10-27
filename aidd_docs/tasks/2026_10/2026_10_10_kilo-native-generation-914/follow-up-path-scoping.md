# Follow-up: Kilo path-scoped rule refusal

## Scope

This follow-up keeps the existing AIDD task for issue #914. It closes the compatibility gap where a canonical rule could carry `paths` while the Kilo renderer only copied that scope into prose, which did not make the scope enforceable.

## Git audit and rebase

Initial audit was read-only and found:

- branch: `feat/kilo-native-generation-914`
- worktree: clean before the rebase
- `origin`: `git@github.com:waewoo/framework.git`
- `upstream`: `git@github.com:ai-driven-dev/framework.git`
- PR #992: open, base `next`, head `feat/kilo-native-generation-914`
- PR #992 base before synchronization: `940e8e...`
- branch before synchronization: `c0f51a1c`
- divergence before synchronization against `upstream/next`: 42 behind, 45 ahead
- patch-equivalence check: no equivalent branch commits were identified by `git cherry upstream/next HEAD`

The user authorized synchronization. A recoverable local reference was created at `backup/kilo-914-before-rebase-20261027`, then the branch was rebased onto the fetched canonical `upstream/next` at `829a5db6`. Git skipped exact duplicate patches and the remaining conflicts were resolved in favor of the current upstream contracts while retaining the Kilo additions. The rebased branch is now `3bcad8c4`.

No push was performed. The remote PR branch still points to the pre-rebase `c0f51a1c`; updating it requires a later authorized force-with-lease push.

PR #1069 remains an open, separate Kilo flat-rules branch (`feat/868-kilo-flat-rules`), not merged into `next`; it was not cherry-picked and was not treated as a second implementation to reconcile.

## AIDD workflow

- Existing plan reused: `aidd_docs/tasks/2026_10/2026_10_10_kilo-native-generation-914/plan.md`.
- Existing phase reused: phase 2, rule publication and configuration preservation.
- Implement contract followed: prepare, execute, finalize; the repository instruction not to commit or push takes precedence over the skill's default local-commit rule.
- Assertion contract followed: coding assertions were read and the applicable test, syntax, diff, architecture and documentation checks are being run against the final tree.
- Test contract followed: behavior-focused tests cover the refusal boundary and compatible target behavior.
- Review contract followed statically: changed lines are checked for ownership, atomicity, target compatibility, and scope fit; no runtime UI facet applies.

## Implemented contract

`write-rule.cjs` now refuses any prospective publication where Kilo is an affected target and the next canonical rule has nonempty `paths`. The refusal occurs before native ownership checks, Kilo config inspection, staging, or mutation. It covers create/update, `--publish`, `--plan`, `--check --publish`, and mixed-target fan-out.

Allowed behavior remains explicit:

- Kilo rules without `paths` publish normally and remain idempotent.
- Claude, Cursor and Copilot retain native path scoping.
- Removing Kilo as a target while keeping a path-scoped rule for another target is allowed.
- Deleting a rule removes the prospective Kilo publication; a historical scoped Kilo output is not recreated.

The publication reference and capture/write actions now state this limitation. The former prose-only Kilo `Applies to` prefix was removed.

## Evidence

Targeted writer suite: `34/34` passing in `scripts/__tests__/kilo-rule-publication.test.js` after the guard was implemented. The combined affected suite passed `156/156` under `scripts/check-tests-leave-git-alone.js`.

The focused cases prove refusal without mutation for:

- one and multiple paths;
- mixed Claude/Kilo targets;
- `--plan` and `--check --publish`;
- updating an existing Kilo rule;
- existing project state and config files.

They also prove allowed Kilo-wide publication, Kilo removal, and unchanged Claude/Cursor path rendering. The full scripts suite passed `776/776` with one pre-existing skipped test (`777` total) under the same Git-integrity wrapper. `pnpm test:changed` passed all selected checks, including architecture, links, context contracts and rule generation.

The rebase exposed one stale assertion that still opened the deleted rule-generator `references/tool-paths.md`; `scripts/__tests__/context-kilo-detection.test.js` now limits that detection-reference check to the hook generator, whose contract still owns that file. The current rule contract remains `references/rule-publication.md`.

## Limits

The writer cannot make a Kilo path scope enforceable when the host surface does not provide one. It therefore refuses the target rather than claiming that body prose narrows activation. This does not claim equivalent path semantics across hosts, nor does it change the separate flat-rule coordination in #1069.
