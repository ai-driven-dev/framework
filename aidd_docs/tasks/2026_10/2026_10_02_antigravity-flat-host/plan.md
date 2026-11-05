---
objective: "`aidd setup --ai antigravity` and `aidd translate --to antigravity --as flat` write AIDD skills, the memory hook and agents under `.agents/`, which `agy` loads, without touching files AIDD did not write."
status: in-progress
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: Antigravity CLI as a flat host

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | An isolated `antigravity` flat profile, modelled on Kilo, in project scope, shipped as four PRs under 600 lines each |
| **Source** | ai-driven-dev/framework#511, spike `aidd_docs/backlog/spikes/antigravity-supported-surfaces.md`, Kilo PR #745 and its review |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 2   | `antigravity` profile with skills, registered everywhere, golden cell | [`phase-2.md`](./phase-2.md) |
| 3   | Memory hook in `.agents/hooks.json` | [`phase-3.md`](./phase-3.md) |
| 4   | Portable agents under `.agents/agents/<name>/agent.md` | [`phase-4.md`](./phase-4.md) |
| 5   | Docs, AIDD skill references and local runtime evidence | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://antigravity.google/docs/hooks | `hooks.json` is keyed by hook name, no `hooks` wrapper; handlers sit directly under an event, a `matcher` entry only for `PreToolUse`/`PostToolUse`; events `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`; `SessionStart` works though undocumented (spike, #890) |
| https://antigravity.google/docs/subagents?tab=cli | agents at `.agents/agents/<name>.md` or `<name>/agent.md`; `name`, `description` required; `model` in `inherit`/`flash`/`pro`; `tools` a YAML list |
| Issue #890 | hooks only from `hooks.json`; hook process `cwd` is `<repo>/.agents` on 1.2.5 |
| Issue #916 comments | `agy` silently drops an agent with `model: sonnet`/`opus` or a comma-separated `tools`, while `plugin validate` passes |
| Spike, 2026-10-02 | print-mode turns hang after answering: runtime evidence reads `cli-*.log` lines and markers, never the turn's end; a turn needs a login, so no CI runtime smoke |
| Probe, 2026-10-05, `agy` 1.2.17 | print mode never reaches the model and fires no hook; an interactive session under a pty with `--add-dir` does. Hook `cwd` is `<repo>/.agents`, stdin `workspacePaths[0]` is `<repo>` |

## Decisions

| Decision | Why |
| -------- | --- |
| The shared plugin-path uninstall bug stays out of #511; phases are numbered 2 to 5 | Codex and Antigravity both write `.agents/skills/`, and uninstalling one deletes plugin files the other still records (probe `uninstall-tools-shared-plugin-path.probe.unit.test.ts` fails). Product owner's call on 2026-10-05: track it separately, ship #511 with it as a known limitation |
| Setup and `plugin add` merge the `aidd-context` plugin's hooks into `.agents/hooks.json` through the project-hooks route Cursor uses, generalised to a per-tool format; not through `HooksCapability`, not through a JS bridge like Kilo | `agy` reads a JSON file natively; Codex's `HooksCapability` is never fed (no `codex-hooks` config ref exists), so copying it would write nothing; the project-hooks route already has idempotent merge, provenance and clean |
| The hook command is chosen from a measured `cwd` on `agy` 1.2.17 (`<repo>/.agents`, so `cd .. && node …`), not assumed | `update_memory.js` exits 0 in silence when `aidd_docs/` is absent from `cwd`, so a wrong `cwd` looks like success |
| The portable agent frontmatter builder lives in `tools/domain/formats/`, not in the profile | it is a cross-host shape (#916 reuses it for Codex flat and Kimi); only the Antigravity paths stay in `profiles/antigravity/` |
| No CI runtime smoke; CI gets the golden cell and the `build-per-tool` matrix row only | a turn needs a Google login and print mode hangs; the Kilo review's "real binary in the gate" lesson cannot hold here, so the PR says so instead of shipping a skipped test |
| Native plugin mode, telemetry host, duplicate-agent-name rejection stay out | #511 out of scope; duplicate `name` rejection belongs to #916 |
