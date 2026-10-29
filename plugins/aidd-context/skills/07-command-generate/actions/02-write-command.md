# 02 - Write command

Build one canonical command and write it for each supported tool.

## Input

From 01: the name, goal, location, arguments, and write mode.

## Output

One command file per supported confirmed tool, the list of files written, and any skipped tool with its reason.

## Process

1. **Build.** Copy [command-template.md](../assets/command-template.md) into one canonical command: single objective, under ten steps, no Role section. Strip the scaffold (comments + `<...>`).
2. **Frontmatter.** Render only the fields and location supported by the selected host, as specified in [tool-paths.md](../references/tool-paths.md). Drop unsupported fields.
3. **Arguments.** If the command takes input, reference it with `$ARGUMENTS`. For a CLI call, use the injection syntax only where the target tool supports it, otherwise describe the command in the body ([command-authoring.md](../references/command-authoring.md)).
4. **Preflight.** Render every supported selected output in memory, then resolve and validate every selected target and reference before creating anything, using [tool-paths.md](../references/tool-paths.md). Check the last target too. Refuse unsafe, symlinked, non-writable, colliding or target-specific requested fields unsupported by that tool; a refusal found here leaves all selected targets unchanged.
5. **Publish.** Before each write, compare that target's current state with its preflight state; stop on a detected change and report any outputs already published. Per the write mode ([tool-paths.md](../references/tool-paths.md)):
   - **Host**: for each supported confirmed tool, write to its path at the chosen location. Skip an unsupported tool, carrying its reason forward.
   - **Plugin source**: write one canonical `.md` command. No per-tool fan-out.
6. **Validate.** Run the write-target validation ([tool-paths.md](../references/tool-paths.md)). Skip unchanged bytes; a repeated confirmed request is idempotent and preserves mtime. This interpreted workflow does not promise a multi-target rollback.

## Test

- Each command file exists at its tool's commands path, at the chosen location.
- The body carries no Role section. It uses `$ARGUMENTS` when the command takes input.
