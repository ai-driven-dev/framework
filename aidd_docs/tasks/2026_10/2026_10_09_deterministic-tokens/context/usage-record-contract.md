# Usage record contract (draft v0)

One record per billed model call. Facts only: no cost, person, task, ticket or step.
Those are derived downstream, once, for every tool.

| Field | Type | Meaning |
| --- | --- | --- |
| `tool` | string | `claude-code`, `codex`, … |
| `tool_version` | string \| null | version that wrote the source line |
| `key` | string | stable across re-reads, unique within `tool`; storage is idempotent on `(tool, key)` |
| `session_id` | string | the tool's own session id |
| `agent` | `main` \| `subagent` \| `advisor` | who made the call |
| `at` | ISO-8601 UTC | when the call was recorded |
| `model` | string \| null | model that billed this call |
| `input` | int \| null | input tokens **excluding** any cache read or write |
| `output` | int \| null | output tokens **including** reasoning |
| `cache_read` | int \| null | input tokens served from cache |
| `cache_write` | int \| null | input tokens written to cache, all TTLs |
| `cache_write_1h` | int \| null | of which 1-hour TTL; `null` when the tool does not say |
| `reasoning` | int \| null | of which reasoning, a subset of `output`; `null` when the tool does not say |
| `cwd` | string \| null | raw working directory of that line, joined to a worktree downstream; local only |
| `git_branch` | string \| null | raw, data only, never an attribution source |

Rules: an unknown value is `null`, never `0`. A shape the reader does not recognise is reported, never guessed.

## Per-tool normalisation (proved on fixtures, each by a mutation)

Claude Code
- key `message.id:requestId`; requestless lines `message.id:sessionId:timestamp`; keep the row with the largest total (streaming snapshots, resumed copies).
- drop `<synthetic>`.
- `cache_write` and `cache_write_1h` summed over `iterations[type=message]`; the top-level `cache_creation` split reflects only the first iteration (measured, 86 requests on 2026-10-07; ccusage 20.0.26 under-counts by it).
- each `iterations[type=advisor_message]` is its own record, `agent: advisor`, its own model; top-level usage excludes it.
- `isSidechain` or `agentId` → `subagent`.

Codex
- key `session_meta.id:total_token_usage.total_tokens` (monotonic: 3,765/3,765 on 50 real rollouts).
- skip a `token_count` whose cumulative total did not move (verbatim re-emission, 3.5 % of events on 200 rollouts).
- `input = last.input_tokens − last.cached_input_tokens` (OpenAI input is inclusive of cache).
- model from the preceding `turn_context`.

## Open

- Codex forks and sub-agents: `session_meta` carries `forked_from_id`, `parent_thread_id`, `subagent_history_start_ordinal`. Does a forked rollout replay parent `token_count` events? If so the key above double-counts across sessions.
- Claude `cache_write_1h` across iterations when a later iteration writes 1h: fixture asserts the sum; real occurrence not yet measured.
- `cwd` per line for Codex: `turn_context.cwd` assumed to follow directory changes; not measured.
