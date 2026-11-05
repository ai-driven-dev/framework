# Review protocol

Review yourself the memory files the AI loads every session, in one sweep across them. Catch what their writer could not see.

Memory holds what the code cannot show: an intent, a constraint, a warning. Code silent on a line is
not code that contradicts it.

1. **Check** the files against the code: every path against the tree, every command against the script or target defining it, every count and named tool against the manifests.
2. **Flag** each of these, with a reason and a location:
   - A claim the code contradicts, or that has gone stale.
   - A command, path, or file that does not exist or would not run.
   - A "why" the code and history do not support.
   - A decision, convention, or gotcha the code shows but the file omits.
   - A fact that belongs under another file's name, for check to dedup.
   - Any breach of the reader rules in `memory-rules.md`. The machine rules are the engine's, never yours.
3. **Return** the flags. Do not edit the files.
