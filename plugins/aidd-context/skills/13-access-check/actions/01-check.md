# 01 - Check

Probe each access the project memory records for the assistant, then fill the report.

## Input

- `aidd_docs/memory/ecosystem.md`: the services and how each actor reaches them.
- `aidd_docs/memory/browsing.md`, when present: the browser tool, target and authentication conventions.
- The memory file each tool's node names, such as `vcs.md` or `backlog.md`: the expected target, and the account when it records one.
- Optionally, one tool name, to check that tool only.

## Output

A printed report from [access-report.md](../assets/access-report.md), or one stop message. No file written.

## Process

1. **Require.** Stop on the first case that holds, with its message:
   - `aidd_docs/memory/` holds no `.md`: propose `/aidd-context:02-project-memory` to set up the memory.
   - No `ecosystem.md` and no browser tool in `browsing.md`: propose `/aidd-context:02-project-memory refresh` to add access information.
   - No `Agent` edge in `ecosystem.md` and no browser tool in `browsing.md`: report that nothing is for the assistant to check.
2. **Map.** One row per `Agent -- <label> --> <Tool>` edge, quoted or not.
   - The label is the access mode: `cli`, `mcp`, `http` or `web`.
   - `Human` and `App` edges get no row: their access is not the assistant's.
   - Take the expected target, the command for `cli`, and account if any, from the file named after the node's middle dot, never from the tool itself or a guess.
   - If `browsing.md` names a browser tool, add a row for it using that file's access mode (`native`, `cli`, or `mcp`), target and account. Use `—` for an unrecorded mode. If an Agent edge already represents that same browser tool, use one row, not two. Do not collapse rows for separate services reached through the browser.
   - A tool argument matches a node's name, case aside, and keeps its rows only. `browser`, `browsing`, or the recorded browser tool's name selects the browser row; an unknown tool stops with the tools the memory lists.
3. **Probe.** Find the account once per command or server, then one read per row on its target.
   - `cli`: the command's auth status, any token line left out, then a read-only subcommand that lists or views the target.
   - `mcp`: a read tool of that server.
   - `http`: one authenticated `GET`, the token taken from the environment.
   - `web`: the assistant's browser tool, when it has one.
   - Browser tool row: use the recorded tool to read its recorded target without changing state. If the tool is unavailable, report 🔌; if no target is recorded, report ⚠️. Do not infer a working session from configuration alone.
4. **Report.** Follow [access-report.md](../assets/access-report.md).
   - If `ecosystem.md` is missing, report that service access could not be checked and recommend a memory refresh, while still reporting the browser row.

## Test

| Case | Pass |
| --- | --- |
| Empty bank | proposes `/aidd-context:02-project-memory`, stops |
| No `ecosystem.md` or browser memory | proposes `/aidd-context:02-project-memory refresh`, stops |
| `Human` and `App` edges only, no browser memory | reports nothing to check, stops |
| Report | one row per `Agent` edge plus the recorded browser tool, no row for `Human` or `App` |
| Browser already represented by an `Agent` edge | one row for that browser tool; separate services retain their rows |
| Browser memory without `ecosystem.md` | reports the browser row and the missing service-access memory |
| Browser without a target or unavailable | reports ⚠️ for an absent target or 🔌 for an unavailable tool, never ✅ from configuration alone |
| One access fails | its row is ❌ with one corrective action, the next rows still probed |
| Target read, no account in memory | its row is ✅ |
| Another account than memory records | its row is ⚠️, naming expected and observed |
| Command missing or signed out | its row is 🔌, next step: install or sign in |
| No target in memory, or no command for `cli` | its row is ⚠️, next step: record it in memory |
| Tool argument | only that tool's rows; browser aliases select the recorded browser tool |
| Every run | no file under the project changed, no secret printed |
