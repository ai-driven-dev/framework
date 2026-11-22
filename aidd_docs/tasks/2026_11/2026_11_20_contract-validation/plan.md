---
objective: "Every framework artifact kind is validated by one generic engine against its own contract, with the same findings for the model, a contributor and CI."
status: pending
---

# Plan: Contract-driven artifact validation, tranche 1

Source: `aidd_docs/tasks/2026_11/2026_11_20_contract-validation/spec.md` (issue #1149)

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Engine and vendoring | [`phase-1.md`](./phase-1.md) | none |
| 2   | One slot syntax | [`phase-2.md`](./phase-2.md) | none |
| 3   | Skill and agent contracts | [`phase-3.md`](./phase-3.md) | 1, 2 |
| 4   | Plan and run contracts | [`phase-4.md`](./phase-4.md) | 1, 2 |
| 5   | Rule, command, story and hook contracts | [`phase-5.md`](./phase-5.md) | 1, 2 |
| 6   | Repository run, baseline and CI | [`phase-6.md`](./phase-6.md) | 3, 4, 5 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none | none |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | none: Node built-ins only; skills keep their own copy of the engine, so flat-mode hosts still resolve every require (refacto-cli finding) | 1 |
| regression | high: `check-skill.test.js`, `scaffold-skill.test.js`, `validate-plan.test.js`, `validate-implement.test.js`, `hook-verification.test.js` assert today's CLI output; safety net is the parity harness run against the old scripts before each is deleted | 1, 3, 4, 5 |
| architecture | one engine source in `scripts/contract/`, copied into each skill's `scripts/lib/` and checked byte-identical, replaces four hand-written validators | 1 |
| documentation | `aidd_docs/memory/testing.md` strategy row, `skill-authoring.md` R13, writer references, the actions that run the validators, and the generated `plugins/*/CATALOG.md` | 3, 4, 5, 6 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| `aidd_docs/memory/testing.md` | scripts suite runs only through `check-tests-leave-git-alone.js`, never bare |
| `scripts/check-hook-rule-copies.js` precedent | a shared file copied into plugins must stay byte-identical, checked in CI |
| `a-skill-links-only-inside-itself.test.js` | a skill never links outside its folder |
| `comments-name-files-that-exist.test.js` | a code comment names only files that exist |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Engine vendored per skill in `scripts/lib/`, source in `scripts/contract/` | a require across skill folders breaks on flat-mode hosts |
| `verify-hook.cjs` deleted, its per-host run check not replaced | user decision: the contract holds form only |
| Writers keep their input refusals | they guard the input before writing, the contract guards the written file |
| CI job in `validate.yml`, not in lefthook | git hooks belong to PR #1316 |
