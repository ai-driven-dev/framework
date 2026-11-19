---
status: done
---

# Instruction: Agent generator writes agy tool names

## Architecture projection

```txt
.
├── plugins/aidd-context/skills/06-agent-generate/
│   ├── references/agent-authoring.md ✏️
│   └── scripts/write-agent.cjs ✏️
└── scripts/__tests__/agent-generation.test.js ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | agent JSON with `tools: "Read, Grep"`, and one with no `tools` | inputs ready | cli |
| Happy path   | `write-agent.cjs --tools antigravity` on the agent without `tools` | `.agents/agents/<name>/agent.md` lists `read_file`, `edit_file`, `write_file`, `run_command`, `manage_task`, `search_web` | cli |
| Edge case    | same with `tools: "Read, Grep"` | `tools` is `read_file` once | cli |
| Edge case    | same with only names that have no agy equivalent | `tools` is an empty list, never the full list | cli |

## Tasks to do

### `1)` Failing writer tests

> Lock the agy frontmatter the writer must produce.

1. Change the antigravity expectation in `agent-generation.test.js` from `Read`, `Grep` to `read_file`.
2. Add the no-`tools` and no-equivalent cases.
3. Run the suite wrapped and watch the three fail on `tools`.

### `2)` Writer maps to agy names

> The generator applies agy 1.5.9's conversion rule, the same table as the CLI.

1. In `write-agent.cjs`, give the antigravity host the conversion: full list when no `tools`, per-grant map otherwise, duplicates removed, unmapped grants dropped.
2. Correct A3's reason in `agent-authoring.md`: agy gives an agent without `tools` a read-only set, so the writer always writes the list.
3. Run the suite and watch it pass; drop `Bash` from the map and watch the mapping test fail.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | the three antigravity cases fail before the change, each on `tools` |
| 2 | the wrapped scripts suite passes; the mutation turns the mapping test red; A3 no longer claims every host grants all tools |
