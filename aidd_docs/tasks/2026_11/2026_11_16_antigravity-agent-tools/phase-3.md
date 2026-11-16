---
status: done
---

# Instruction: Runtime proof on agy and contributor gates

## Architecture projection

```txt
.
├── cli/src/contexts/tools/domain/profiles/antigravity/
│   └── agent-tools.ts ✏️
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | user logged into agy; `pnpm build`; `translate` the framework `--to antigravity --as flat` into a scratch project | `.agents/agents/aidd-orchestrator-executor/agent.md` lists the agy tools | cli |
| Happy path   | in agy, delegate to `aidd-orchestrator-executor`: create `hello.txt` containing OK, then `cat hello.txt` | `hello.txt` holds OK; the subagent transcript calls `write_file` or `run_command` | cli |
| Edge case    | the subagent hangs or reports a missing tool | the offending name is removed from the table and phase 1 tests updated | cli |
| Teardown     | delete every chat the proof created and the scratch project | no test chat left under `~/.gemini/antigravity-cli/` | system |

## Tasks to do

### `1)` Prove the list on agy 1.5.9

> Settle the runtime verdict the plan leaves unverified.

1. Run the issue's repro with `agy -p --print-timeout 180s` against a fresh flat build; judge by `hello.txt` and the subagent transcript, never by the turn ending, since print mode can hang after answering.
2. If `agy -p` still reports no login, hand the same repro to the user's interactive agy session and read its subagent transcript.
3. Correct the table if a name fails; keep the agy version the rule was read from in `agent-tools.ts`.
4. Delete the chats created.

### `2)` Contributor gates

> Every gate green before commit and push.

1. `pnpm exec lefthook run pre-commit --all-files`.
2. `pnpm exec lefthook run pre-push`.
3. `pnpm exec commitlint --edit` on the commit message.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `hello.txt` contains OK in the scratch project, and the transcript shows the subagent's write or command call |
| 2 | all three commands exit 0 |
