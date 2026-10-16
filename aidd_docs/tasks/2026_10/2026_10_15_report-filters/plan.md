---
objective: "A report can be narrowed to the calls of one task, ticket, person, model, agent, session or repository, and every row it prints can be selected that way."
status: done
---

# Plan: The report takes filters

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | `--task X --axis day` answers "what did task X cost per day"; a filter adds up to the row it selects |
| **Source** | [`contract.md`](./contract.md), issue #1030 |

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | A filter selects what a row holds | [`phase-1.md`](./phase-1.md) |
| 2   | The report use case narrows, resolves and refuses in order | [`phase-2.md`](./phase-2.md) |
| 3   | The command and the text say what was selected | [`phase-3.md`](./phase-3.md) |
| 4   | Docs, skill and gates | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| A filter matches through `axisValueOf`, exported from `usage-report.ts` | a filter and a row cannot then disagree on a call |
| `--unattributed` is a selector on `task` that also occupies `ticket` | an unattributed call is unattributed on both axes; one place states it |
| Prefixes are resolved in the use case, against the period's calls | the domain filter only ever compares exact values |
| One option parser per flag checks choices and repetition | Commander's `.choices()` replaces any `argParser`, so it cannot also reject a repeated flag |
| The report use case receives `refusedByEnvironment` | `.` runs git, and refusal must come first |
