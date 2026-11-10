# Engine

- Find `memory.cjs` by file name before any call; the first hit wins: the plugin's `hooks/` beside `skills/`, then `hooks/aidd-context/` under the tool's folder, then `hooks/` inside this skill.
- Run the engine; never open its source or `lib/`.

| Command | When | Effect |
| ------- | ---- | ------ |
| `node memory.cjs check . aidd_docs/memory/<file>.md` | per file | checks that file |
| `node memory.cjs check .` | whole bank | checks the whole bank |
| `node memory.cjs changes .` | refresh, before the review | prints the `Since` line, the memory lines citing a changed file or directory, the changed files by directory; `--since <ref>` names an older base |
| `node memory.cjs facts <sheet> .` | before the write | exits 1 naming each bad sheet line; fix the sheet and run it again |
| `node memory.cjs vanished . --sheet <sheet>` | after the write | lists each line gone from the bank as committed, HEAD only, unless a `D` line quotes it |
| `node memory.cjs sync [--add] <tool>...` | after the upsert | tool names only, no root; fills each named tool's block, or with none every block already there; `--add` appends the block to a picked tool's file holding none; stop on a non-zero exit |
