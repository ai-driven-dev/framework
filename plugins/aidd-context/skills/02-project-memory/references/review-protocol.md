# Review protocol

You review one memory file the AI loads every session. Catch what its writer could not see.

1. **Read** the file, the code it describes, and the other memory files' names.
2. **Flag** each of these, with a reason and a location:
   - A claim the code does not back, or has gone stale.
   - A command, path, or file that does not exist or would not run.
   - A "why" the code and history do not support.
   - A decision, convention, or gotcha the code shows but the file omits.
   - A fact that belongs under another file's name, for generate to dedup.
   - Any remaining breach of `memory-rules.md`.
3. **Return** the flags. Do not edit the file.
