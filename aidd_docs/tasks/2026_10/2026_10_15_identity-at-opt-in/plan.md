---
objective: "Each person chooses, at opt-in, the name they are measured under, or to stay anonymous, and the report and status say which."
status: done
---

# Plan: Who is measured is chosen at opt-in

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | `on` asks or takes `--as`/`--anonymous`; `status` and the text report name the person or `anonymous` |
| **Source** | [`contract.md`](./contract.md), issue #1029 |

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | The on use case takes an identity choice and writes it only on success | [`phase-1.md`](./phase-1.md) |
| 2   | The command asks, the flags answer, status and report name the person | [`phase-2.md`](./phase-2.md) |
| 3   | Docs, skill and gates | [`phase-3.md`](./phase-3.md) |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| The git name is read through a new port, not the `RepositoryLocator` | the locator answers what a directory is; who the person is is another question, asked only by `on` |
| The use case receives the choice (`keep`, `none`, `{ set: id }`) and writes after consent | a refused `on` must write nothing (rule 4) |
| `anonymous` is a text label only | decision 1 of the contract |
