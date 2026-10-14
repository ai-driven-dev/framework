# 05 - Verify Connection

Check project access and fill the report.

## Input

The project's bank in `aidd_docs/memory/` and the service-connection recipe.

## Output

A printed report using [connection-report.md](../assets/connection-report.md).

## Process

1. **Map.** Read the available `connect-services` recipe ([source](https://github.com/ai-driven-dev/framework/blob/next/plugins/aidd-context/skills/12-cook/assets/recipes/connect-services.md)) and the project memory relevant to its categories to identify required services, accounts and targets.
   - **Coverage.** Include any other relevant memory files or services.
   - **Missing memory.** Mark missing context as unverified, never as not needed.
2. **Check.** Inspect available CLI, MCP, native or API access and perform one read against each required account and target.
   - **Failures.** Continue checking the other services when one fails.
3. **Report.** Fill `connection-report.md` from observed results, with one row per category.

## Rules

- **Scope.** Check the assistant access the project requires; the catalogue is not an installation checklist.
- **Read-only.** No writes, installs, login flows, configuration or memory changes, or secret output.
- **Evidence.** A configured tool alone never proves access; report success only after a read matches the intended account and target.
