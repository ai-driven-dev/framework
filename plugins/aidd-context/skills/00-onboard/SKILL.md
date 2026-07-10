---
name: 00-onboard
description: Guide a project through AIDD, scanning what is set up and missing, then pointing to the single next action. Use when the user says onboard me, where do I start, or what to do next. Not for listing every installed surface.
argument-hint: scan | assess | present | run
---

# Onboard

scan → assess → present → run ↺

## Actions

| #  | Action  | Does                                          |
| -- | ------- | --------------------------------------------- |
| 01 | scan    | reads project state into a snapshot           |
| 02 | assess  | picks the state, the next action, and the screen |
| 03 | present | renders the screen, waits for a reply         |
| 04 | run     | runs the reply, then loops to scan            |

## Transversal rules

- Guide, do not lecture or dump. Lead with where the project stands and the single clearest next action; keep the rest on demand.
- Name real commands only. A command whose skill `01` did not find installed is a gap named by function, never invented.
- Never run a GUIDED step unattended, and never test a plugin version against a registry.
- Re-scan after a run, never trust a stale status. Wait for an explicit reply before running anything.
