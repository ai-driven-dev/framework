# Review protocol

- Review yourself the memory files the AI loads every session, one file at a time.
- Memory holds what the code cannot show: an intent, a constraint, a warning. Code silent on a line does not contradict it.

## Scope

- Update: only the lines `changes` names.
- Audit: the files a row produces or lists under Accepted names, one at a time, against the files that define its facts.

## Content

1. **Check** each file against the code: every path against the tree, every command and commit type against the file that defines it, per the reading rules of [reading-sources.md](reading-sources.md), every count and named tool against the manifests and the workspace file.
2. **Flag** each of these, with a reason and a location:
   - A claim the code contradicts or that has gone stale, or a command, path or file that would not run.
   - A "why" the code and history do not support.
   - A decision, convention, or gotcha the code shows but the file omits.
   - A fact that belongs under another file's name, for check to dedup.
   - Any breach of the reader rules in `memory-rules.md`. The machine rules are the engine's, never yours.
3. **Return** the flags. Do not edit the files.

## Format

- Last of the reading, run the whole-bank check once.
- Its errors on the files a row produces or lists under Accepted names become findings, never a team file's.
- Count its warnings and do not investigate them.

## Structure

Take the structure findings of that run; judge none.

- A root file no row produces is the team's: keep it.
- A root file in a row's Accepted names column is that row's file: offer nothing on it.
- A file a row produces found in `internal/` or a subfolder, or a folder under `memory/` other than `internal/` and `external/`, is misplaced: report it as `move <path> to <path>` and move nothing.
