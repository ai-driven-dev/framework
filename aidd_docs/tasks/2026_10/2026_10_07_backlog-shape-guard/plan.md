---
objective: "A change confined to the plugin files that teach backlog-link.json fails at pre-commit when it breaks what the reader accepts."
status: implemented
---

# Plan: the guard that runs on plugin changes parses what it guards

## Overview
| Field | Value |
| --- | --- |
| **Goal** | move the structural assertions to the guard that already sees `plugins/**` |
| **Source** | [`source.md`](./source.md) |

## Phases
| # | Phase | File |
| --- | --- | --- |
| 1 | the taught example is parsed where it is watched | [`phase-1.md`](./phase-1.md) |

## Resources
| Source | Verified |
| --- | --- |
| `lefthook.yml` | `scripts-tests` carries `glob: "{scripts,plugins,cli/src}/**"`, so it runs on a plugin change; `cli-knip` and `cli-test` carry `glob: "cli/**"` and do not |
| `.github/workflows/cli-ci.yml:70` | the `changes` job matches `cli/*\|kanban/*\|scripts/__tests__/*\|README.md` and `plugins/aidd-telemetry/*` minus prose. `plugins/aidd-pm/**` matches nothing |
| `scripts/__tests__/a-backlog-link-the-reader-can-read.test.js:73` | asserts `text.includes('"backlog"')`, a substring check that never parses the example |
| `cli/tests/contexts/telemetry/infrastructure/task-backlog-skill-shape.integration.test.ts` | parses the example and feeds it to the real `TaskBacklogAdapter`, which a repository script test cannot reach |

## Decisions
| Decision | Why |
| --- | --- |
| The structural assertions go to the `scripts/` guard | it is the only one of the two that runs on a change confined to `plugins/**` |
| Neither filter is widened | `plugins/**` would run 6800 cli tests on a prose edit, and a narrow path list is the hand-maintained duplication that caused this: those paths moved last week |
| The `cli/` test keeps the adapter crossing | a repository script test cannot import across that boundary, which is the whole reason that test exists |
| The guard parses the example rather than reading field names | a file that keeps the three strings while ceasing to be JSON is exactly the case that fell between the two guards |
| The mutation ships with the guard | `aidd_docs/memory/coding-assertions.md` requires watching the named test go red for the reason it names |
