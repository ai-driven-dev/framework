---
status: done
---

# Instruction: Agy tool names in the Antigravity agent build

## Architecture projection

```txt
.
├── cli/
│   ├── src/contexts/tools/domain/profiles/antigravity/
│   │   ├── agent-tools.ts ✅
│   │   └── build.ts ✏️
│   └── tests/
│       ├── contexts/tools/domain/profiles/antigravity/
│       │   ├── agent-tools.unit.test.ts ✅
│       │   └── build.unit.test.ts ✏️
│       └── golden/snapshots/framework-build/golden.json ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | source agent markdown with `name`, `description`, no `tools` | fixture ready | system |
| Happy path   | `transform` of the agent for antigravity | frontmatter `tools` lists `read_file`, `edit_file`, `write_file`, `run_command`, `manage_task`, `search_web` | system |
| Edge case    | source declares `tools: Read, Grep, Bash, Task` | `tools` is `read_file`, `run_command`, `manage_task`, each once; `Task` dropped | system |
| Edge case    | source declares only names with no agy equivalent | `tools` is an empty list, never the full list | system |
| Edge case    | `UPDATE_FRAMEWORK_GOLDEN=1` recapture | only `.agents/agents/*/agent.md` hashes change | cli |

## Tasks to do

### `1)` Failing tests

> Lock the expected agy frontmatter before the code exists.

1. Add `agent-tools.unit.test.ts`: no source list gives the full list; Claude names map; unknown names drop; a list that maps to nothing stays empty.
2. Update the `build.unit.test.ts` frontmatter expectation with the `tools` block.
3. Run both and watch them fail on the missing `tools`.

### `2)` Tool table in the Antigravity profile

> The profile owns the Claude to agy naming and the agy version it was measured on.

1. Create `agent-tools.ts` from agy 1.5.9's conversion rule: `Read`/`Glob`/`Grep`, `Edit`/`MultiEdit`, `Write`, `Bash` (two agy tools), `WebSearch`/`WebFetch`; the full list; `antigravityAgentTools(declared)` deduplicating.
2. In `build.ts`, replace the frontmatter `tools` with `antigravityAgentTools` of the parsed source list.
3. Run the tests and watch them pass; break the map and watch the named test fail.

### `3)` Golden recapture

> Re-baseline only the agent cells.

1. Run the framework build golden with `UPDATE_FRAMEWORK_GOLDEN=1`, then without it.
2. Confirm the diff touches only `.agents/agents/` hashes.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | both test files fail before the code, each on the missing or wrong `tools` |
| 2 | the tests pass; removing `Bash` from the map turns the mapping test red |
| 3 | golden suite green; `git diff` of `golden.json` changes agent hashes only |
