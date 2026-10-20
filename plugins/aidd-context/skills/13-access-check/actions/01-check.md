# 01 - Check

Probe each access the project memory records for the assistant, then fill the report.

## Input

- `aidd_docs/memory/ecosystem.md`: the services and how each actor reaches them.
- The memory file each tool's node names, such as `vcs.md` or `backlog.md`: the expected account and target.
- Optionally, one tool name, to check that tool only.

## Output

A printed report from [access-report.md](../assets/access-report.md), or one stop message. No file written.

## Process

1. **Require.** Stop on the first case that holds, with its message:
   - `aidd_docs/memory/` holds no `.md`: propose `/aidd-context:02-project-memory` to set up the memory.
   - No `ecosystem.md`: propose `/aidd-context:02-project-memory refresh` to add it.
   - No `Agent` edge in `ecosystem.md`: report that nothing is for the assistant to check.
2. **Map.** One row per `Agent -- <label> --> <Tool>` edge.
   - The label is an access mode, or the command that reaches the tool, probed as `cli`.
   - `Human` and `App` edges get no row: their access is not the assistant's.
   - Take the expected account and target from the memory, never from the tool itself.
   - A tool argument keeps its rows only; an unknown tool stops with the tools the memory lists.
3. **Probe.** One read per row, proving both the account and the target.
   - `cli`: a read-only command, such as an auth status, then a read on the target.
   - `mcp`: a read tool of that server.
   - `http`: one authenticated `GET`, the token taken from the environment.
   - `web`: the assistant's browser tool, when it has one.
4. **Report.** Fill the report, one status per row:
   - ✅ the read matches the expected account and target.
   - ❌ the read failed: name one corrective action, then probe the next row.
   - 🔌 the command, server or browser tool is absent.
   - ⚠️ the read worked on another account or target, naming both; or memory records none, next step: record it in memory.

## Test

| Case | Pass |
| --- | --- |
| Empty bank | proposes `/aidd-context:02-project-memory`, stops |
| No `ecosystem.md` | proposes `/aidd-context:02-project-memory refresh`, stops |
| `Human` and `App` edges only | reports nothing to check, stops |
| Report | one row per `Agent` edge, no row for `Human` or `App` |
| One access fails | its row is ❌ with one corrective action, the next rows still probed |
| Another account | its row is ⚠️, naming expected and observed |
| No expected account in memory | its row is ⚠️, next step: record it in memory |
| Tool argument | only that tool's rows |
| Every run | no file under the project changed, no secret printed |
