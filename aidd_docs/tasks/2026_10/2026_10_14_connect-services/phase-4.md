---
status: done
---

# Instruction: Record the change and prove it end to end

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── aidd_docs/tasks/2026_10/2026_10_14_connect-services/
    ├── challenge.md                          ✏️ verdict on the new scope
    └── review.md                             ✏️ phase 2 is the new skill, not a 02-project-memory action
```

## User Journey

```mermaid
flowchart TD
  A[Reviewer opens the PR] --> B[reads challenge.md and review.md]
  B --> C[sees each review finding and where it was resolved]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Happy path
    Run the pre-commit gate => green, CATALOG.md and README counts regenerated: 5: cli
    Run the scripts tests => green: 5: cli
    Run the CLI suite => green, H4 validator tests included: 5: cli
    Run git diff --check against origin/next => no whitespace error: 5: cli
    Run /aidd-context:13-access-check on this repository => report rows for the gh edges with evidence: 5: cli
  section Edge case - empty bank
    Temporary copy without aidd_docs/memory/ => run the skill => proposes 02-project-memory setup: 1: cli
  section Teardown
    Delete the temporary copy => repository unchanged: 5: system
```

## Tasks to do

### `1)` Task records

> The PR explains itself.

1. `challenge.md`: scope, verdict and evidence for the extracted skill.
2. `review.md`: replace the 02-project-memory phase with the new skill; map each review finding (#1 to #11) to its resolution.

### `2)` Gates

> Every assertion green.

1. `pnpm exec lefthook run pre-commit`.
2. `node --test 'scripts/__tests__/*.test.js'`.
3. `cd cli && pnpm test`.
4. `git diff --check origin/next`.

### `3)` Live run

> The skill does what its `## Test` claims.

1. Run the skill on this repository and keep the printed report.
2. Run it on a temporary copy without memory and keep the stop message.

## Test acceptance criteria

| Task | Acceptance criteria                                                                 |
| ---- | ----------------------------------------------------------------------------------- |
| 1    | each of the eleven review findings appears in `review.md` with its resolution       |
| 2    | every gate exits 0                                                                  |
| 3    | the live report has one row per Agent edge of `aidd_docs/memory/ecosystem.md`       |
| 3    | the empty-bank run proposes `/aidd-context:02-project-memory` and writes nothing    |
