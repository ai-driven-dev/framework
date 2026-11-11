# Review protocol

## Scope

- Review yourself, never with a subagent.
- Review every line of the files a row produces or lists under Accepted names, against its source and the code.
- Start with the lines `changes` cites; look for new facts in the files it lists.
- Review a line outside the change set too.

## Content

Flag, with a reason and a location, when:

- a path is missing from the tree;
- a command or commit type disagrees with its defining file, per [reading-sources.md](reading-sources.md), or would not run;
- a count or named tool disagrees with the manifests or workspace file;
- a claim is contradicted by the code or stale;
- a "why" lacks support in code and history;
- the code shows a decision, convention or gotcha the file omits;
- a fact belongs in another file, for check to dedup;
- the reader rules of [memory-rules.md](memory-rules.md) are breached; the machine rules are the engine's, never yours.

Never flag a line the code is silent on: memory holds what the code cannot show.

## Format

- Run the whole-bank check once, last of the reading.
- Its errors on the files a row produces or lists under Accepted names are findings, never a team file's.
- Its warnings are not findings: do not investigate or count them.

## Structure

- Take any structure finding from that run; judge none of your own.
- Keep a root file no row produces: it is the team's.
- Offer nothing on a root file in a row's Accepted names column: it is that row's file.
- Keep a file a row produces in `internal/` or `external/`: the team reads it on demand.
- Report a folder under `memory/` other than `internal/` and `external/` as `move <path> to <path>`; move nothing.
