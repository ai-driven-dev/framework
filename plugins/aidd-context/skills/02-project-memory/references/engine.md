# Engine

The commands the actions run.

- Find `memory.cjs` by file name before any call; the first hit wins: the plugin's `hooks/` beside `skills/`, then `hooks/aidd-context/` under the tool's folder, then `hooks/` inside this skill.

| Command | When | Effect |
| ------- | ---- | ------ |
| `node memory.cjs check . aidd_docs/memory/<file>.md` | per file | checks that file |
| `node memory.cjs check .` | whole bank | checks the whole bank |
| `node memory.cjs changes .` | refresh or check, before the review | prints the scope, the base, the changed files, the memory lines citing one, the files to review; `--since <ref>` names an older base |
