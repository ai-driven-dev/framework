---
objective: "Kilo-only projects can use the applicable aidd-context generation workflows through documented Kilo surfaces, without overwriting user-owned context or inventing unsupported hooks."
status: delivered-with-known-validation-limits
---

# Plan: Kilo-native generation in aidd-context

Source: [Issue #914](https://github.com/ai-driven-dev/framework/issues/914), the historical plan and phase files, and the current implementation at `f05904eff0733a37f822aa24d85c380edccbc42f`.

This is a retrospective record, not an active implementation plan. Its status fields distinguish the historical plan from the current reconstructed PR and are not intended to pass the current plan validator.

## Strategy revision

### Initial strategy

The initial plan covered six phases: Kilo detection and memory; configuration-backed rules; skills; agents and workflows; hook guidance; and evidence/runtime validation across supported platforms. It also included cross-tool compatibility and broader `skill-eval` work while the implementation was underway.

### Maintainer request, 2026-11-05

The maintainer requested a Kilo-focused PR, extraction of unrelated `skill-eval`, memory, and hook changes, coordination with the project-memory rewrite, and a rebase on `next`. The stated concern was integration conflict or loss during that rewrite. See the [review](https://github.com/ai-driven-dev/framework/pull/992#pullrequestreview-5767586134). The author's earlier questions about splitting work are not treated as decisions.

### Revised scope and consequences

The following describes the contributor's implementation after the request, not additional decisions attributed to the maintainer:

- Keep only changes required for the #914 Kilo surfaces. Kilo memory wiring, Kilo configuration/rule publication, and Kilo hook guidance remain in scope.
- Remove general `skill-eval` host support and unrelated memory/filesystem or hook refactors.
- Keep deterministic Kilo runtime coverage and the CI work needed to run it. This replaces part of phase 6's validation objective, but not its broader LLM-evaluation objective.
- Reconstruct the branch from `next` and rebase it linearly. Do not reconstruct phase-sized commits or claim a one-to-one phase/commit history.
- Record historical phase status separately from current delivery status. A phase once marked `in-progress` stays historically incomplete even where its relevant Kilo code is now delivered.

## Phases and status

| # | Historical objective | Depends on | Historical status | Current PR status | Current outcome / remaining evidence |
| --- | --- | --- | --- | --- |
| 1 | Recognize Kilo and share project memory | None | `done` | Adapted and delivered | Kilo detection and `AGENTS.md` memory projection retained; unrelated memory hardening excluded. See [phase 1](./phase-1.md). |
| 2 | Publish Kilo rules without losing configuration | #979 shared writer | `in-progress` | Kilo-specific implementation delivered | Shared writer extended for Kilo; no authenticated Claude validation is claimed. See [phase 2](./phase-2.md). |
| 3 | Generate a native skill or an explicitly chosen portable skill | 1 | `done` | Retained and delivered | Native and explicit portable targets; current runtime evidence has fixture/provider limits. See [phase 3](./phase-3.md). |
| 4 | Generate native agents and workflows | 1 | `done` | Retained and delivered | Native `.kilo/agents/` and `.kilo/commands/` generation. See [phase 4](./phase-4.md). |
| 5 | Give accurate Kilo hook guidance without invented conversion | 1 | `done` | Kilo-specific portion retained | Documentation and generation guidance remain; unrelated hook changes excluded. See [phase 5](./phase-5.md). |
| 6 | Consolidate generation/runtime evidence across platforms | 1–5 | `in-progress` | Superseded in part; broader evaluation removed | Native Kilo E2E and CI retain part of its validation goal; broad `skill-eval` extensions and genuine-LLM generation proof were not delivered. See [phase 6](./phase-6.md). |

## Acceptance boundary

The issue's 16 acceptance criteria remain the source contract. The current code and tests cover Kilo detection, memory routing, config-backed rule publication, native/portable skills, agents, workflows, hook guidance, and selected safety/idempotence cases. CI is green at the current SHA. Several criteria remain partially demonstrated because contract/fixture tests do not prove every LLM decision or generator-to-runtime provenance. `CONTRIBUTING.md` also asks contributors to test in Claude Code and one other tool; no authenticated Claude run is available for this change. See the criterion-by-criterion evidence boundary in [verification](./verification.md).

## External sources

| Source | What it establishes |
| --- | --- |
| [Issue #914](https://github.com/ai-driven-dev/framework/issues/914) | Original need, Kilo surface contracts, and 16 acceptance criteria. |
| [Maintainer review on #992](https://github.com/ai-driven-dev/framework/pull/992#pullrequestreview-5767586134) | Scope/rebase request and its stated memory-rewrite rationale. |
| [Kilo official documentation](https://kilo.ai/docs/customize/skills) | Kilo path claims and formats cited by the implementation docs; issue baseline 2026-09-25. |
| [Project Memory Challenge](https://github.com/ai-driven-dev/framework/tree/next/aidd_docs/tasks/2026_11/2026_11_06_project-memory-challenge) | Documentation structure reference only; its commit-per-phase rule is specific to that plan. |

## Impact

| Surface | Current PR evidence |
| --- | --- |
| `plugins/aidd-context/` | Kilo detection, memory routing, skills, rules, agents, commands, and hook guidance. |
| `scripts/__tests__/` | Contract/fixture tests and Kilo rule publication tests. |
| `cli/tests/e2e/` and `.github/workflows/cli-ci.yml` | Native Kilo runtime checks and platform CI. |
| General `skill-eval` host support | Removed; not delivered by this PR. |

## Rules

- The November 5 review defines the requested scope boundary; implementation details retained afterward are the contributor's choices unless separately confirmed.
- Repository `CONTRIBUTING.md` requires Conventional Commits and tests in Claude Code plus one other tool. It does not require one commit per phase.
- Current platform CI does not substitute for an authenticated Claude Code run.

## Decisions

| Decision in the retained implementation | Evidence / boundary |
| --- | --- |
| Extend the shared #979 rule writer rather than introduce a competing Kilo writer. | Current rule writer and tests; detailed rationale in [design](./design.md). |
| Use native `.kilo/` destinations; allow `.agents/skills/` only after explicit choice. | Issue contract and current generator contracts. |
| Document Kilo plugin hooks without emitting declarative hooks or a plugin runtime. | Issue contract and current hook guidance. |
| Treat scripted-provider E2E as runtime protocol evidence, not an LLM quality evaluation. | [Verification record](./verification.md). |

## Commit traceability

Commit links below identify related work, not phase-sized or equivalent commits. The old phase-1 and phase-3 manifests give explicit associations; other mappings are by change family and may group several former commits into one current commit.

| Phase | Historical commits | Current commits | Mapping |
| --- | --- | --- | --- |
| 1 | [`4eed91c`](https://github.com/ai-driven-dev/framework/commit/4eed91c366620ff2473ae751826c5e03802f75ac), [`9179e60`](https://github.com/ai-driven-dev/framework/commit/9179e60d7489c5b82780f83a0285e976d3ddf6c8), [`859994c`](https://github.com/ai-driven-dev/framework/commit/859994ca12b8b1d1daf0f3e06316fa0b2feaf7ef) | [`d3bef20`](https://github.com/ai-driven-dev/framework/commit/d3bef201b8028528fedb077de51ef7472539709b) | Detection and memory family consolidated. |
| 2 | [`35edbdc`](https://github.com/ai-driven-dev/framework/commit/35edbdc02fd427b8ad6c53810dba38a536ccb691) and related rule/config work | [`512889c`](https://github.com/ai-driven-dev/framework/commit/512889c02e19367c68c807bccfd72ac99b2adba9) | Kilo rule/config publication family; not one-to-one. |
| 3 | [`442091f`](https://github.com/ai-driven-dev/framework/commit/442091f288788e185c3586f87e4c3531c1a5cbe9) | [`f339b01`](https://github.com/ai-driven-dev/framework/commit/f339b013374e0a53d90d62c6465457384174a2d9) | Skill work grouped with agent/workflow generation. |
| 4 | [`781125f`](https://github.com/ai-driven-dev/framework/commit/781125f8ac5e2138ca018b433543c686b2674263) | [`f339b01`](https://github.com/ai-driven-dev/framework/commit/f339b013374e0a53d90d62c6465457384174a2d9) | Grouped with phase 3 in the reconstructed commit. |
| 5 | [`826ad89`](https://github.com/ai-driven-dev/framework/commit/826ad89b9b1f029eac92298838e646fc63c03a91) | [`779879b`](https://github.com/ai-driven-dev/framework/commit/779879b4098084aa04ffb87a3f76cb15a4d516a1) | Kilo hook guidance retained. |
| 6 | [`7a2d5d2`](https://github.com/ai-driven-dev/framework/commit/7a2d5d2192dfd9a0784509c15b1ddf87e81bbe42) and related evidence work | [`77205a1`](https://github.com/ai-driven-dev/framework/commit/77205a1f051cb32c5eb532495f6ca9546a462ad3), [`9a1a8b1`](https://github.com/ai-driven-dev/framework/commit/9a1a8b131f5630917d8a05329f1b5acce86a4a60), later E2E/CI commits | Validation objective partly replaced; no `skill-eval` extension retained. |

The remaining current sequence adds acceptance tests, platform/runtime fixes, and CI updates, ending with [`f05904e`](https://github.com/ai-driven-dev/framework/commit/f05904eff0733a37f822aa24d85c380edccbc42f), the Windows path-normalization fix. The committed implementation diff contains 95 files relative to `upstream/next`; these nine proposed documentation files are additional and are not included in that count.
