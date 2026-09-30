
# Plan: Architecture guard on AI-authored edits

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Refuse an AI edit that would hardcode a sibling plugin's address, or leave a skill's `## Actions` section out of step with its action files, before the edit lands. |
| **Source** | [`spec.md`](./spec.md), from [ai-driven-dev/framework#250](https://github.com/ai-driven-dev/framework/issues/250) |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | The two rules, as a tested engine | [`phase-1.md`](./phase-1.md) |
| 2 | The refusal, at the AI host's write moment | [`phase-2.md`](./phase-2.md) |

## Resources

| Source | Verified |
| --- | --- |
| `docs/ARCHITECTURE.md`, capability addressing | A capability is addressed only where dispatch is declared: a router's `## Actions` table, an agent's `# Skills you may invoke` list. Agent permission lists and orchestration references legitimately name a provider; recipe skills never do. |
| <https://code.claude.com/docs/en/hooks> | `PreToolUse` receives `tool_input` before the tool runs — `content` for `Write` — and refuses the call with `hookSpecificOutput.permissionDecision: "deny"` plus a `permissionDecisionReason` the model reads. `PostToolUse` cannot refuse, it only reports after the fact. |
| `.claude/hooks/check-written-file.js` | The in-repo precedent for a hook that reads the payload from stdin, resolves the written file, and hands a report back in the same turn. |
| Issue #250, comment of 2026-09-14 | Supersedes the issue body's "Guardrail local et CI": no Git hook, no CI gate, synthetic fixtures, #406 neither blocker nor fixture. |
| Probe over the 51 skills and 8 plugins in the tree | Both rules, as scoped below, report zero violations on the repository as it stands — orthogonality across 37 real cross-plugin addresses, router coherence across 48 skills that hold action files. The probe measured both directions; only the decidable one ships, per the decision below. |

## Decisions

| Decision | Why |
| --- | --- |
| `PreToolUse`, not `PostToolUse` | The decision is "prevent the write until it is corrected". `PostToolUse` fires after the file is already on disk; Biome gets away with it only because it rewrites in place, and this guard cannot rewrite prose. |
| The engine is a plain module, the hook is a thin caller | A rule that is a pure function of (path, prospective content, action-file listing) is testable without a hook, a host, or a tree. The hook contributes only the payload and the refusal. |
| The governed surface is `SKILL.md`, `actions/`, `references/`, `agents/` | That is where dispatch is declared. `assets/` hold sheets a reader reads — `12-cook`'s recipes name 20 cross-plugin commands on purpose — so they are excluded by a stated rule, never by a quiet path filter. |
| An orchestrator plugin is exempt from rule one, and only rule one | `docs/ARCHITECTURE.md` makes orchestration references responsibility maps. `aidd-orchestrator` holds 14 of the tree's cross-plugin addresses for exactly that reason. Router coherence is a different rule and applies to it like any other plugin. |
| The router rule reads the `## Actions` section, not the table | `10-todo` names its one action as a path in a fenced block rather than a table row. Scoping to the section and matching either the stem or the file name covers both shapes and still reports zero on the tree. |
| Unit tests live under `scripts/__tests__/`, and that is not a CI gate on the rules | Pre-commit runs those tests against synthetic fixtures, proving the engine works. Nothing scans the tree at commit time or in CI, which is what the decider ruled out. |
| Fixtures are written for this task | The spec forbids #406's historical code. Each rule gets a breaking fixture and a legitimate-naming fixture, so a guard that flags a permission list fails its own suite. |
| The hook is wired for Claude Code alone | It is the only host this repository configures hooks for: `.codex/config.toml` carries a sandbox mode and nothing else. Codex, Cursor and Copilot all expose `PreToolUse` and the same deny shape, but Codex delivers a file edit as an `apply_patch` command string rather than a path and a content, which is a different parse. The engine is host-agnostic, so each adapter is additive and none of them touches a rule. |
| Rule two enforces one direction, not two | A citation with no file behind it cannot be told apart from a citation written just before the file it names. Enforcing it deadlocked adding an action: creating the file first was refused for not being named, naming it first was refused for having no file, and `aidd-context:04-skill-generate` documents the second order. The decidable direction is kept. |
| An action is named by a citation, never by a word | Plain containment over the section let ordinary prose pass for a mention: `plan` appears in "the plan is the culmination", so deleting that action's row went unnoticed. Measured over the tree, containment missed 20 of 78 row deletions; citation matching misses none that has a row. |
| One plugin source was repaired, and it is the exception | `plugins/aidd-dev/skills/01-plan/actions/04-plan.md:16` read "declare it the same way `aidd-pm:04-spec` does", which is rule one's own violation in prose. The spec's non-goal keeps existing violations out of scope, and the hard constraint says a rule red on the tree is miscalibrated — so the one line that was genuinely wrong was fixed, and the seven in `00-onboard` were exempted with #883 behind them instead. No other plugin source is touched. |
| A stem speaks for its action only when no sibling shares it | `01-plan.md` and `04-plan.md` both reduce to `plan`, so one row would cover both and deleting either would go unnoticed. A shared stem cites nobody; the numbered name still does. No skill in the tree has a collision today, which is why it had to be reasoned about rather than observed. |
| A fenced block is an example, never a router | The section scan blanks fences before reading headings and tables, so a documented `## Actions`, a `##` inside the section, and an example table all stop steering the verdict. Path citations are read from the unblanked lines, because `10-todo` legitimately cites `actions/01-todo.md` inside a fence. |
| Only the path shape reads through a fence | Both shapes read the unblanked lines at first, which let a backticked `<name>.md` inside a fenced example cite — the very hole blanking fences was for. `10-todo` needs the path shape and nothing needs the other, so the exception is one shape wide. |
| A table resumed after a blank line keeps its column | A run of rows with no `| --- |` beneath it is read as the table above it, resumed. Otherwise inserting one blank line — changing no content — refuses every row below it. The cost: a separator-less glossary written just under the router donates its cells, so a deleted row could hide behind it. Neither shape is a table a renderer accepts, and the false refusal is the worse failure. A column-count check does not separate them: a glossary often has the router's width. |
| A separator row counts from two dashes | `aidd-context:00-onboard` writes `| -- |` and GitHub renders it. Requiring three silently stopped the header being recognised, which unnamed every action in that skill. The real-tree sweep caught it. |
| A fence nobody closed is not a fence | Blanking from an unterminated fence to end of file hides a `## Actions` that is visibly there, and the refusal then reads "has action files but no ## Actions section" — unactionable. The whole document is read as unfenced instead. |
