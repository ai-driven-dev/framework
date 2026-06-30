# 01 - Init context file

Ensure each target tool's AI context file carries the project memory block.

## Input

The project root.

## Output

One context file per confirmed tool, each carrying an empty `<aidd_project_memory>` block.

## Process

1. **Detect.** Find the context files already present, by the per-tool paths in `@../references/mapping-ai-context-file.md`. Only those paths qualify; any other file is user content, off-limits.
2. **Resolve tools.** On a re-run, the tools present are the confirmed set, skip the prompt. Otherwise propose the detected tools plus the full list and ask which the user uses; wait for an explicit pick, never default to all.
3. **Upsert.** For each confirmed tool, write the memory block into its context file per `@../references/memory-block.md`.

## Test

- Every confirmed tool's context file exists and contains a `<aidd_project_memory>` block.
