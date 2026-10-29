# 02 - Write agent

Render the canonical agent per confirmed tool and write it.

## Input

From 01: the role, the chosen name, an optional user-specified model, and the write mode.

## Output

One agent file per confirmed tool, and the list of files written.

## Process

1. **Build.** Copy [agent-template.md](../assets/agent-template.md) into one canonical agent. Strip the scaffold (comments + `<...>`).
2. **Frontmatter.** Apply the per-tool frontmatter from [tool-paths.md](../references/tool-paths.md). Drop a field where the tool does not support it. For Kilo, use filename identity, `description`, `mode: subagent`, and only requested options. Plugin source: keep the canonical frontmatter.
3. **Convert.** Apply any per-tool structural conversion listed in [tool-paths.md](../references/tool-paths.md). Plugin source skips conversion.
4. **Preflight.** Render every selected output in memory, then resolve and validate every selected target and reference before creating anything, using [tool-paths.md](../references/tool-paths.md). Check the last target too. Refuse unsafe, symlinked, non-writable, colliding or target-specific requested fields unsupported by that tool; a refusal found here leaves all selected targets unchanged.
5. **Publish.** Before each write, compare that target's current state with its preflight state; stop on a detected change and report any outputs already published. Per the write mode ([tool-paths.md](../references/tool-paths.md)):
   - **Host**: for each confirmed tool, write to its path and extension.
   - **Plugin source**: write one canonical agent. No per-tool fan-out.
6. **Validate.** Run the write-target validation ([tool-paths.md](../references/tool-paths.md)). Skip unchanged bytes; a repeated confirmed request is idempotent and preserves mtime. This interpreted workflow does not promise a multi-target rollback.

## Test

- Each agent file exists at its tool's agents path.
- The file is valid for the AI target tool.
