---
name: plan
description: A feature's implementation plan - rules, phases, risks, decisions. One phase file sits next to it per phase.
objective: "{one-line objective, matches the source}"
success_condition: "{a command or check that proves the plan is done}"
plan_status: in_progress
iteration: 0
created_at: "{YYYY-MM-DDTHH:MM:SSZ}"
---

<!-- Plan contract: plan.md in aidd_docs/tasks/<yyyy_mm>/<yyyy_mm_dd>_<feature-slug>/ · objective matches the source · success_condition is runnable · plan_status starts in_progress · the architecture projection lives in the phase files, not here · English, tables over prose, one idea per sentence, prefer removing over adding. -->

# Plan: {title}

## Overview

| Field          | Value                   |
| -------------- | ----------------------- |
| **Risk Score** | {X}/10                  |
| **Source**     | {file, ticket, or text} |

## Applicable rules

| Tool   | Rule   | Path     | Why it applies |
| ------ | ------ | -------- | -------------- |
| {tool} | {name} | `{path}` | {one-line why} |

## Phases

| #   | Phase        | File                               |
| --- | ------------ | ---------------------------------- |
| 1   | {phase-name} | [`phase-1.md`](./phase-1.md) |
| 2   | {phase-name} | [`phase-2.md`](./phase-2.md) |

## Risk register

| Risk     | Impact                        | Mitigation                            |
| -------- | ----------------------------- | ------------------------------------- |
| {risk 1} | {what breaks if this happens} | {how the plan prevents or handles it} |

## External resources

| Source | Verified                    |
| ------ | --------------------------- |
| {url}  | {what it settled, one line} |

## Decisions

| Decision   | Why            |
| ---------- | -------------- |
| {decision} | {one-line why} |
