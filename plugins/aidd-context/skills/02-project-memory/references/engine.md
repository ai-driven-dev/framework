# Engine

- Take the first `memory.cjs` found, in this order:
  1. The plugin's `hooks/`, beside its `skills/` folder.
  2. `<dot folder>/hooks/aidd-context/` at the project root: hooks may sit in another dot folder than this skill.
  3. `hooks/` inside this skill.
- Never take another copy from elsewhere in the project.
- Run the engine; never open its source or `lib/`.

| Command | When | Effect |
| ------- | ---- | ------ |
| `node memory.cjs check . aidd_docs/memory/<file>.md` | per file | lints that file |
| `node memory.cjs check .` | whole bank | lints the bank |
| `node memory.cjs changes .` | refresh, before the review | prints the `Since` line, the memory lines citing a changed file or directory, the changed files by directory; `--since <ref>` names an older base |
| `node memory.cjs plan <sheet> --tools <tool,...>` | before the answer | checks the sheet; writes `plan.md` and a snapshot of the bank beside it; prints the counts and, in full, each line a remove or replace drops; exits 1 naming each bad sheet line, or on a sheet already answered |
| `node memory.cjs answer <sheet> "<reply>"` | after the answer | marks each item's sheet lines yes or no for ok, no, not <n> or a range; any other reply exits 1, changing nothing |
| `node memory.cjs report <sheet>` | after the sync | prints the closing message, described below |
| `node memory.cjs sync [--add] <tool>...` | after the write | tool names only, no root; fills each named tool's block, or with none every block there and copilot's pointer; `--add` appends the block to a picked tool's file holding none; stop on non-zero exit |

The `report` message holds, in this order:

- Each line gone from the bank since the plan's snapshot, but not one a `D` line answered yes quotes.
- If no line was checked, it says so there instead.
- What was written, changed and left out, by the plan's numbers, each seen on disk.
