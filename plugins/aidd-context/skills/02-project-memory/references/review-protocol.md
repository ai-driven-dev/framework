# Review protocol

- Review yourself the memory files the AI loads every session, one file at a time, or only the ones holding a line `changes` names.
- Memory holds what the code cannot show: an intent, a constraint, a warning. Code silent on a line does not contradict it.

1. **Check** each file against the code: every path against the tree, every command and commit type against the file that defines it, per the reading rules of [reading-sources.md](reading-sources.md), every count and named tool against the manifests and the workspace file.
2. **Flag** each of these, with a reason and a location:
   - A claim the code contradicts or that has gone stale, or a command, path or file that would not run.
   - A "why" the code and history do not support.
   - A decision, convention, or gotcha the code shows but the file omits.
   - A fact that belongs under another file's name, for check to dedup.
   - Any breach of the reader rules in `memory-rules.md`. The machine rules are the engine's, never yours.
3. **Return** the flags. Do not edit the files.
