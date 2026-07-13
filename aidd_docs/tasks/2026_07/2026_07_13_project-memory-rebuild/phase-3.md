---
status: pending
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Sync that adapts

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
plugins/aidd-context/
├── hooks/
│   └── update_memory.js                  ✏️ accept an optional picked-tool list, fill only those; no-arg keeps fill-all-present
└── skills/02-project-memory/
    ├── actions/
    │   └── 03-sync.md                    ✅ create the context file when missing, upsert the block, run the fill script
    └── references/
        └── memory-block.md               ✏️ keep the upsert cases, add the create-when-missing case for a picked tool
```

## Tasks to do

### `1)` Write actions/03-sync.md

> The wiring. Owns the context file end to end.

1. For each tool picked in scan, resolve its context-file path per `references/tools.md`.
2. Create the file when missing: copy `@../assets/AGENTS.md`, set the tool's title, per `references/memory-block.md`.
3. Upsert the empty `<aidd_project_memory>` block into every picked tool's file.
4. Run the fill script `hooks/update_memory.js`, passing the picked tools, to fill each block with the memory-file references.
5. Guard: on a non-zero exit, print the error and stop, telling the user to check that `aidd_docs/memory/` holds a `.md` file and that `node` is available.
6. Output: each picked tool's context file, present, wired, and filled.

### `2)` Make update_memory.js respect the picked tools

> Fill only what the user chose, without breaking the auto hook.

1. Accept an optional tool list (CLI args), map each to its context file, fill only those.
2. No argument: keep today's behavior, fill every target file already present.
3. Keep the hook wiring unchanged, the hook calls it with no argument.
4. Never insert a block: a file without `<aidd_project_memory>` is skipped, both no-arg and with-args. Block insertion stays the sync action's job.

### `3)` Update references/memory-block.md

> Add the create case, keep the rest.

1. Keep the existing upsert cases (absent, no section, section-no-block, block-present).
2. State that a tool picked in scan whose context file does not exist gets the file created from the template, not skipped.
3. Note that the fill script only fills an existing block: it creates neither the file nor the block, so both are the action's job before the script runs.
4. State the boundary: a blockless existing file (e.g. a hand-written `AGENTS.md`) is only given a block when its tool is picked; the auto hook never inserts one.

## Test acceptance criteria

<!-- Each criterion is an observable behavior, not a command. -->

| Task | Acceptance criteria                                                                        |
| ---- | ------------------------------------------------------------------------------------------ |
| 1    | sync creates a missing context file for a picked tool, upserts the block, and runs the fill script. |
| 2    | Passing only claude fills `CLAUDE.md` and leaves a pre-existing `AGENTS.md` block untouched; no-arg fills all present. |
| 3    | memory-block.md documents the create-when-missing case and the script's update-only limit.   |
| 4    | A non-zero script exit stops with a message, never a silent partial sync.                     |
