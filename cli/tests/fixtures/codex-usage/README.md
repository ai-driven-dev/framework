# Codex usage fixtures

Real Codex session records, anonymized: ids become `00000000-0000-4000-8000-<n>`, paths `/workspace/p<n>`, free strings `redacted`, timestamps shift to the year 2000. Numbers are kept. Files sit under `sessions/<version>/rollout-fixture.jsonl`.

## Trim rule

Each file keeps, in original order: the first `session_meta`, the first `turn_context`, the first line of every other type present, and the usage lines (2 `token_usage_record` plus 1 `token_count` where the group has records; 2 `token_count` with non-null info where it has none). `ordinal` is renumbered; arrays longer than 4 items are cut to 4.

## Groups

Walk the recorded versions in semver order. A version starts a group when it introduces a line type, or a usage payload key, that no earlier version had. One fixture per group, named by its first version. The set of line types the fixtures hold is pinned by `codex-journal-versions.integration.test.ts`.

| Fixture | Versions it stands for | Introduces |
| --- | --- | --- |
| `0.124.0` | 0.124.0, 0.130.0 | the base types (message, reasoning, tool calls, `token_count`, ...) and `response_item:web_search_call` |
| `0.136.0` | 0.136.0 | `response_item:tool_search_call`, `response_item:tool_search_output` |
| `0.142.5` | 0.142.5 | `event_msg:thread_settings_applied`, `world_state` |
| `0.143.0` | 0.143.0 | `compacted` |
| `0.144.0-alpha.4` | 0.144.0-alpha.4, 0.145.0-alpha.27, 0.145.0, 0.147.0-alpha.1.2 | `event_msg:thread_goal_updated` |
| `0.149.0-alpha.4.1` | 0.149.0-alpha.4.1 | `token_usage_record` and its payload keys, `inter_agent_communication_metadata`, `response_item:agent_message` |
| `0.149.0-alpha.4.3` | 0.149.0-alpha.4.3, 0.149.0, 0.151.0-alpha.7.2, 0.151.0, 0.153.1 | `response_item:additional_tools` |
| `0.154.0-alpha.6.2` | 0.154.0-alpha.6.2 to 0.165.0 (16 versions) | `realtime_item:realtime_session_started`, `realtime_item:realtime_session_closed` |
| `0.166.0` | 0.166.0 to 0.169.0 (7 versions) | `response_item:configuration_update`, `token_count` info key `last_usage_includes_reasoning` |

0.149.0 and 0.151.0 sit in the `0.149.0-alpha.4.3` group although they wrote no `token_usage_record`: the grouping rule looks at what a version introduces, not at what it records.

## Groups that yield 0 records

- `0.124.0` to `0.144.0-alpha.4`: these versions write usage only as `token_count` running totals, which the decoder does not read.
- `0.154.0-alpha.6.2`: kept whole, 3 lines, and carries no usage line, as observed. Its usage shape is covered by `0.149.0-alpha.4.3`.

## Compressed file

Only `0.149.0-alpha.4.1` is stored as `rollout-fixture.jsonl.zst`, to exercise the compressed path.
