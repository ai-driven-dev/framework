# Unify the change taxonomy into one source of truth + a projected board

## Target

Define the change-classification taxonomy and its routing rule **once**, in a single canonical place that every other contributor-facing surface and the project board links to or derives from — never restates.

## Hard constraints

- One canonical home for the taxonomy/routing definition; every other document links to it rather than restating it (repo rule: never duplicate across docs).
- Routing (which branch a change targets) is **derived from the branch prefix**, never stored as a label or a board field.
- The canonical definition must be consumable by both the AI tooling (the always-loaded project memory) and humans, without a second copy existing.
- The distributable plugin templates stay generic — they are products shipped to other projects, not mirrors of this repo's own instance.
- Commit-type and changelog-section definitions are left unchanged (already aligned to Conventional Commits and the release tool).
- Board changes are delivered as a maintainer playbook (the board is external config), not as repo file edits; repo deliverables must not assume the board can be edited as repo files.
- Each board field and each label answers a distinct question; no field may duplicate another field or a label.

## Non-goals

- Renaming the `enhancement` label to `feature` — `enhancement` stays; the spec only documents that it is the label form of a `feat`/feature change.
- Any label-sync workflow or board automation beyond GitHub's built-in project workflows.
- Changing the allowed commit types or the changelog sections.
- Restructuring the generic plugin pull-request / branch templates beyond correcting a stale, incorrect prefix value.
- Building the board for the maintainer — the spec supplies the playbook; applying it is the maintainer's act.

## Done-when

- The change-kind → routing (next vs main) mapping exists in exactly one document; searching the repo finds that mapping rendered once, and every other doc that needs it contains a link to that single home. *(verify: text search shows one occurrence of the mapping table; the release doc and the contributor doc each link to it.)*
- The routing rule is strict and unambiguous: exactly one branch prefix routes to the production branch (the urgent-fix prefix); all other prefixes route to the integration branch. *(verify: the canonical table shows a single production-routed row.)*
- A single contributor front-door document routes a reader to naming+routing, the release flow, and the merge/governance rules, each reachable in one hop. *(verify: the front-door doc contains a link to each of the three; and a text search for the canonical routing table/sentence returns hits only in its canonical home, not in the front-door, release, or governance docs.)*
- The issue/PR label set is reduced to triage-type labels plus the automation labels the tooling requires; no label encodes routing, and a header states labels are triage-only. *(verify: the label list equals the agreed reduced set; a search finds no label used to decide routing.)*
- Labels removed from the canonical list are not recreated by any automation. *(verify: the dependency-update config no longer references the removed labels.)*
- An issue opened from a project issue template is created already carrying its Type label, with no manual step. *(verify: creating an issue via each template yields an issue pre-labelled with its type.)*
- A pull request opened by the project's PR automation targets the branch determined solely by the head branch's prefix, and carries the matching Type label. *(verify: a feature-prefixed branch produces a PR targeting the integration branch; the urgent-fix prefix targets production; the type label is present.)*
- The board exposes only orthogonal fields — the field that duplicated the Type label is gone, and the redundant phase field is gone — while Priority remains. *(verify: board playbook checklist confirms both fields removed and Priority kept.)*
- The board Status field carries the agreed lifecycle states and advances through them via built-in automation, and a Timeline view exists. *(verify: board playbook checklist confirms the Status options, the enabled built-in transitions, and the Timeline view.)*

## Stakeholders

- Decider: Baptiste (resolves any taxonomy/placement tradeoff).
- Owner: Baptiste & Alex (maintainers, long-term owners of the convention and the board).
- Consumer: public contributors (read the docs/board, open issues/PRs) and the AI tooling (reads the canonical memory, opens PRs, applies labels).

## Context

- Source: Alex's Loom review — the same taxonomy is currently re-spelled across branch prefix, commit type, label, and the board "Work type" field, and the four drift; a maintainer got lost finding routing info. The ask: fewer, clearer, non-duplicated, strict rules.
- Guiding principle agreed in brainstorm: one taxonomy, defined once, projected everywhere (docs, label, board field, timeline), advanced by automation, never re-typed by a human.
- Orthogonal property model agreed: Type → label; Priority → board field; Status → board field (auto-advanced); When → milestone/timeline; Effort/onboarding → the good-first-issue label; Routing → derived from branch prefix.
- Existing anchors that constrain the canonical definition: the commit linter (Conventional Commits) and the release tool's changelog sections are already correct and authoritative for their domains; the taxonomy mirrors them, it does not redefine them.
- The board is GitHub Project 8 (public roadmap + maintainer triage), configured outside the repo.
