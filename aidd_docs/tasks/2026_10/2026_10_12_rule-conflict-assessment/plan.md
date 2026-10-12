---
objective: "Assess a candidate rule against applicable existing policies before any rule write, with an explicit resolution and unchanged publication behavior."
status: implemented
---

# Plan: Assess existing rules before writing

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Add the pre-write semantic assessment to the existing rule generator. |
| **Source** | [Issue #791](https://github.com/ai-driven-dev/framework/issues/791), including its agreed four-action flow and comments. |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Assess, resolve, then preserve publication | [phase-1.md](phase-1.md) |

## Resources

| Source | Verified |
| --- | --- |
| [Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md) | Directory-scoped instructions and override precedence. |
| [OpenCode V2 instructions](https://opencode.ai/v2/docs/instructions/) | Root and nested instructions are combined; both versions publish to AGENTS.md. |
| [OpenCode V1 rules](https://opencode.ai/docs/rules/) | Configured instructions and enabled CLAUDE.md fallback are assessment sources. |
| [Claude Code memory](https://code.claude.com/docs/en/memory) | Project rules can be path-scoped and project guidance must be considered. |
| [Cursor rules](https://cursor.com/docs/rules) | Project rules and nested project guidance have applicability conditions. |
| [Copilot CLI instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions) | Repository-wide and path-specific instructions are separate sources. |

## Decisions

| Decision | Why |
| --- | --- |
| Semantic assessment belongs to the skill; the existing writer remains unchanged. | Comparing policies requires interpretation; deterministic publication and ownership remain the script's responsibility. |
| Shorten the loaded skill using Alex's [#981](https://github.com/ai-driven-dev/framework/pull/981) and [#950](https://github.com/ai-driven-dev/framework/pull/950). | One fact per owner; short actions; no repeated checks. Baseline: 3,480 words. Preserve the behavior and newer `next` changes. |
