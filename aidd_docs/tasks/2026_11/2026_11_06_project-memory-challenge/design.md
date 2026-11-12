# Design: project memory, final target

## Responsibilities

| Part | Owns | Never |
| --- | --- | --- |
| Skill `02-project-memory` | judgment: read the code, decide what to remember, write `aidd_docs/memory/*.md`, quote a team line and get a yes before replacing or removing it, ensure the marker pair in each wired context file | runs no script, names no path outside its folder |
| Hook `memory.cjs` | determinism: snapshot, lint, lost lines, sync | writes no memory fact |

## Hook events

| Event | Does |
| --- | --- |
| SessionStart | sync the context-file blocks; snapshot the bank to `os.tmpdir()/aidd-context/<hash(project)>-<session>.json` |
| Stop, once per turn | compare the whole bank with the snapshot; lint the changed files; list lines absent from every bank file, exact, capped at 15; sync; continue the turn once with that text, also shown to the person where the host allows; advance the snapshot |

No snapshot or no session id: Stop says "lost lines not checked". `check` and `sync` stay as subcommands for CI and by hand.

## Removed

Locator, `references/engine.md`, `assets/fact-sheet.md`, `plan`, `answer`, `report`, `changes`, `lib/plan.cjs`, `lib/fact-sheet.cjs`, `lib/report.cjs`, `lib/changes.cjs`, `bank-guard` heuristic, shell-write detection, the aidd-context PostToolUse hook.

## Limits

- Without running hooks (untrusted, no `node`, a host with no Stop), nothing lints and nothing reports losses in session; git diff in review is the net.
- Lint arrives at the turn end, not per write.
- A teammate's edit outside the agent is reported once, then the snapshot advances.

## Done when

1. Scripts suite green, each new guard shown failing by its mutation.
2. Codex, low-end model, real repo, three cases: setup, refresh with a declined item, removal. Each ends with `check` exit 0, no unapproved team line lost, and the lost-line text reaching the person.
3. One opencode run of the removal case shows the Stop text reaching the model.
