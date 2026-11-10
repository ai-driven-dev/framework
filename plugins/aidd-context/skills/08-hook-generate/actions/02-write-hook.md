# 02 - Write hook

Render the entry for each confirmed tool, merge it into the chosen scope, and write the backing script.

## Input

From 01: the moment, action, script need, matcher, scope, confirmed tools, and write mode.

## Process

1. Write the backing script when the action needs one, per [hook-authoring.md](../references/hook-authoring.md).
   - Copy [hook-script-template.sh](../assets/hook-script-template.sh) and fill the logic.
   - Place it in the scope's script directory from [tool-paths.md](../references/tool-paths.md), and make it executable.
   - One script can back every tool.
2. Fill [hook-template.json](../assets/hook-template.json) per confirmed tool, using that tool's shape in `tool-paths.md`, and strip the scaffold.
   - Point the handler at the script by absolute path or an approved `${VAR}`.
3. Read each target file, then append the entry to the moment's list under the right key for the scope.
   - Preserve every sibling and overwrite none.
4. Read [validate](03-validate.md).

## Output

The updated target file per tool, any script written, and the list of paths touched.
