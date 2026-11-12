# Review protocol

## Scope

| Case | Review |
| --- | --- |
| Reviewer | you, never a subagent |
| Every refresh | every line of the files a row produces or lists under Accepted names, one at a time, against its source and the code |
| First | the lines `changes` cites |
| New facts | looked for in the files `changes` lists |
| A line outside the change set | reviewed all the same, never skipped |

## Content

| Check | Flag, with a reason and a location, when |
| --- | --- |
| Every path | the tree lacks it |
| Every command and commit type | the file that defines it, per the reading rules of [reading-sources.md](reading-sources.md), disagrees or it would not run |
| Every count and named tool | the manifests or the workspace file disagree |
| A claim | the code contradicts it or it has gone stale |
| A line the code is silent on | never: memory holds what the code cannot show |
| A "why" | the code and history do not support it |
| A decision, convention, or gotcha | the code shows it and the file omits it |
| A fact | it belongs under another file's name, for check to dedup |
| The reader rules of [memory-rules.md](memory-rules.md) | breached; the machine rules are the engine's, never yours |

## Format

| Step | Do |
| --- | --- |
| Last of the reading | run the whole-bank check once |
| Its errors on the files a row produces or lists under Accepted names | become findings, never a team file's |
| Its warnings | not findings: do not investigate or count them |

## Structure

| Found | Do |
| --- | --- |
| Any structure finding | taken from that run; judge none of your own |
| A root file no row produces | the team's: keep it |
| A root file in a row's Accepted names column | that row's file: offer nothing on it |
| A file a row produces in `internal/` or `external/` | the team's choice to read it on demand: keep it there |
| A folder under `memory/` other than `internal/` and `external/` | no loading rule reaches it: report it as `move <path> to <path>` and move nothing |
