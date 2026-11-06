---
status: done
---

# Phase 1: Each memory file is named by what it holds

## Problem

The lean slice merged capability files under names that tell a reader nothing (`contract.md`, `native.md`, `async.md`, and `data.md` holding the database as well) and folded `codebase-map.md` into `architecture.md`. On Codex, Cursor, OpenCode and Copilot the memory reaches the model as links, so the file name alone decides whether a file is opened. Haiku also created `contract.md` next to a team's `cli.md`, and `check` offered on this repository's banks to merge `cli.md` and `codebase-map.md`, which would build files over the 400-word limit.

## Tasks

| # | Task |
| --- | --- |
| 1.1 | Templates and the capability table follow the plan's naming decision: one row per file, each with a one-line meaning and its detection |
| 1.2 | A project exposing several surfaces writes one file per surface |
| 1.3 | `ui.md` keeps the macro questions; a first slot says that when `aidd_docs/ui/` exists the detail and the design system live there, and nothing of them is copied |
| 1.4 | The outside-service questions move to `ecosystem.md` |
| 1.5 | Older names are accepted per the plan; the engine's former-file and merge path is deleted, and `check` offers no merge |
| 1.6 | The question bank and its guard follow: every slot still has a home |

A previous attempt at the accepted names, on the parent of this branch, is saved as a reference patch outside the repository.

## Acceptance

| Test | Pass |
| --- | --- |
| `memory-check.test.js`: a bank holding `cli.md`, `codebase-map.md`, `design.md`, `infra.md` and `integration.md` | no merge or former line, no missing-file error; fails on the parent commit |
| `memory-templates.test.js`: no template or table names `contract.md`, `native.md` or `async.md`; `database.md` and `data.md` are two templates; `ecosystem.md` holds the outside-service questions; `ui.md` holds the macro questions and the `aidd_docs/ui/` slot | fails on the parent commit |
| `check .` and `check cli` | exit 0, no merge line |
| Eval, Haiku, three runs: refresh of a bank holding a team's `cli.md` | `cli.md` unchanged where its facts are true, no second contract-like file |
| Eval, Haiku, three runs: setup of a CLI project | `cli.md` written with `# CLI` |
