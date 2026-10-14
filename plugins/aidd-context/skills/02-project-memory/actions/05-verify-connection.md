# 05 - Verify Connection

Check project access and fill the report.

## Input

The project's bank in `aidd_docs/memory/` and the local `connect-services.md` recipe.

## Output

A printed report using [connection-report.md](../assets/connection-report.md).

## Process

1. **Map**: Resolve `connect-services.md` from the local recipe catalogue, then read it by its relative path and read the relevant project memory to identify required services, accounts and targets.
   - Include any other relevant memory files or services.
   - Mark missing context as unverified, never as not needed.
2. **Check**: Inspect available CLI, MCP, native or API access and perform one read against each required account and target.
   - Continue checking the other services when one fails.
3. **Report**: Fill `connection-report.md` from observed results, with one row per category.

## Rules

- Check the assistant access the project requires; the catalogue is not an installation checklist.
- No writes, installs, login flows, configuration or memory changes, or secret output.
- A configured tool alone never proves access; report success only after a read matches the intended account and target.
