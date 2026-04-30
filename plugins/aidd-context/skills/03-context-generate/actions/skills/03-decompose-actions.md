# 03 — Decompose into actions

Break the skill into atomic, testable actions — one action, one unambiguous job.

## Inputs

- `expected_output` (from 01)
- `evals/scenarios.json` (from 02 in generate flow, or existing in modify flow)

## Outputs

An `action_plan` table. Example for a hypothetical `slack` skill:

| slug             | description (input → output)                     | test                                                                                           | depends_on |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------- |
| `post-message`   | Post a message (channel, text) → message_id      | Post "hello" to #test, verify via `mcp__slack__slack_get_channel_history` it appears top-1.    | —          |
| `get-history`    | Fetch the last N messages of a channel           | Fetch last 5 from #general; assert array length = 5 and each entry has `ts` + `user` fields.   | —          |
| `create-channel` | Create a channel (name, is_private) → channel_id | Create `#test-{ts}`; assert `channel_id` returned + channel listed via `slack_list_channels`.  | —          |

The `test` cell of each row will be **transcribed verbatim** into the `## Test` section of the generated action file in 05. No transformation. Concrete inputs, concrete assertions, observable side-effect.

Tests must be real-execution: status 200, artifact created, MCP returning the expected value. Never a mocked `*.test.js` — the first successful run is the test.

## Process

1. For each `expect_action` in evals (excluding `null`), trace backward: what action produces that output? What feeds it?
2. Group by atomicity. Split if process > ~100 lines. Merge + parameterize if ≥ 80% logic shared.
3. One-shot configs (API key load, `.env` source, client init) stay inline in the consuming action's `## Process`. Create a dedicated action only if independently callable OR reused by ≥ 2 downstream actions.
4. Ordering: `sequential = true` → numbered prefixes `01-`, `02-` (see `references/naming-conventions.md`).
5. Write the `test` cell row by row — concrete inputs, concrete assertion. Pick whichever fits: a command to run, an artifact check, or an API/MCP/state side-effect.
6. Present the table. **Validate the `test` column row by row with the user, in writing.** No silent acceptance.

## Test

Every `expect_action` from evals (excluding `null`) appears in the table exactly once; every row has a non-empty `test` cell explicitly approved by the user in writing; no row depends on a downstream slug.
