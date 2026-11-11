# 02 - Write hook

Write the hook's entry for each confirmed tool, merged into the chosen scope, and its backing script.

## Input

From 01: the moment, script, whether it blocks, matcher, scope with its plugin or file, confirmed tools, and write mode.

## Process

1. Write the backing script, so the entry only wires it.
   - Copy [hook-script-template.sh](../assets/hook-script-template.sh) and fill the logic.
   - Set the exit code and stdout the way each target tool reads them, per [hook-handlers.md](../references/hook-handlers.md).
   - Place it where [hook-paths.md](../references/hook-paths.md) says, and make it executable.
   - One script can back every tool.
2. Build the entry per confirmed tool in that tool's shape from [hook-shapes.md](../references/hook-shapes.md).
   - [hook-template.json](../assets/hook-template.json) is the Claude Code shape only.
   - Replace each `<...>` slot with the event name, the matcher and the handler command, and drop the matcher line for a match-all hook.
   - Point the handler at the script in a form `hook-paths.md` allows.
3. Write each target file the scope names in [hook-scopes.md](../references/hook-scopes.md).
   - Missing: create it holding the entry.
   - Existing: read it, append the entry to the moment's list, and keep every other entry.
   - A Codex `config.toml`: merge into its `[hooks]` table the same way.
4. Read [validate](03-validate.md).

## Output

The updated target file per tool, the script written, and the list of paths touched.
