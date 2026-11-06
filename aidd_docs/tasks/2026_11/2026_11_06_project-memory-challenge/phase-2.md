---
status: pending
---

# Phase 2: Nothing a person did not approve leaves the bank

## Problem

`actions/03-check.md` offers to remove a file when the scan does not find its capability, and detection varies: Haiku writes 6 to 9 files for the same repository. `vanished` only lists lost lines; Qwen still drops 15, 7 and 18 baseline lines in a refresh that declines removals.

## Tasks

| # | Task |
| --- | --- |
| 2.1 | Check never offers to remove a file: a file whose capability the scan did not find is reported, nothing more |
| 2.2 | `memory.cjs vanished <file> [root] [--approved <file>]`: the approved file lists the lines the person approved removing or replacing; a line gone and not approved is printed and exits 1; an approved one is never printed |
| 2.3 | `02-write.md` writes each approved removal or correction into that file before writing, and on exit 1 restores nothing itself: it shows the lines and asks |
| 2.4 | `vanished` never runs from a hook |

## Acceptance

| Test | Pass |
| --- | --- |
| `memory-check.test.js`: `vanished` with a gone line that is approved | exit 0, prints nothing; fails on the parent commit |
| `memory-check.test.js`: a gone line not approved, and a line moved to another file | exit 1 naming the first; the moved line prints nothing |
| `memory-skill-files.test.js`: no action offers to remove a file | fails on the parent commit |
| Eval, three runs on Haiku and three on Qwen: the refresh case that declines removals | baseline lines dropped without approval: 0 |
