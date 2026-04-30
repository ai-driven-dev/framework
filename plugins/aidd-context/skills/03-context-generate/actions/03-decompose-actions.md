# 03 — Decompose into actions

Break the skill into atomic, testable actions. One action = one unambiguous job.

## Inputs
- `expected_output` (from 01)
- `evals/scenarios.json` — from 02 in generate flow, or the existing file in modify flow

## Outputs

An `action_plan` table. Example for a hypothetical `slack` skill:

| slug             | role                         | inputs               | outputs         | test_strategy | depends_on |
| ---------------- | ---------------------------- | -------------------- | --------------- | ------------- | ---------- |
| `post-message`   | Post a message to a channel  | channel, text        | message_id      | mcp-runbook   | —          |
| `get-history`    | Fetch channel history        | channel, limit       | messages[]      | mcp-runbook   | —          |
| `create-channel` | Create a new channel         | name, is_private     | channel_id      | mcp-runbook   | —          |

`test_strategy` is one of `script` | `mcp-runbook` | `llm-assertion`.

## Process

1. For each `should` scenario, trace backward: what final action produces the output? What feeds it?
2. Group by atomicity — one action, one job.
3. If an action's process would exceed ~100 lines, split it.
4. If two actions share ≥ 80% logic, merge and parameterize via `## Inputs`.
5. Ordering: `sequential=true` → numbered prefixes `01-`, `02-`; visual grouping by family is also valid (see `references/naming-conventions.md`).
6. Every distinct `expect_action` in evals must map to exactly one action here.
7. Present the table to the user. Validate before action 04.

## Test

LLM assertion: every `expect_action` (excluding `null` and `ask_clarification`) from `evals/scenarios.json` appears exactly once in the plan; no action depends on a downstream action; each action has a single responsibility.
