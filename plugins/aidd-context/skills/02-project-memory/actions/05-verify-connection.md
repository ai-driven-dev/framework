# 05 - Verify Connection

Verify the assistant's access to the services declared in project memory.

## Input

The bank in `aidd_docs/memory/`, and an optional service to check.

## Output

A connection report printed using [connection-report.md](../assets/connection-report.md).

## Process

1. **Scope.** Read the service map and relevant memory files to identify the assistant's expected tools, accounts and targets.
   - No memory bank: report it missing and stop.
   - Include required access that the memory describes but this session lacks.
   - Include browser access when the project requires web validation.
2. **Inspect.** Check one declared CLI, MCP or native tool per service against its official documentation.
   - No available tool: report the missing access without installing anything.
   - Unknown account or target: mark it unverified unless a read can resolve it.
3. **Read.** Confirm the account and target, then read one known item through the selected tool.
   - Browser: open the application and read visible content.
   - Database: read metadata without changing data or running migrations.
   - No writes, configuration changes, login flows or secret output.
   - Continue with the other services when a check fails.
4. **Report.** Fill [connection-report.md](../assets/connection-report.md) with one row per category, grouping its required services.
   - Keep every category; mark unused categories as not needed.
   - A category passes only when every required service was read successfully.
   - A failure or missing access takes precedence over an unverified result.
   - A configured tool alone never proves access.
   - A successful read never proves write permissions.
   - Keep these session results out of the durable memory bank.

## Test

| Case | Pass |
| --- | --- |
| Report | exactly one row per template category, with its services grouped |
| Declared service | its category row names the tool, account, target and observed read |
| Several required services | the category passes only when every required read succeeds |
| Category unused | its row remains and is marked not needed |
| Required access missing | its row reports failure and the next action |
| Read fails | its row reports the error and other services are still checked |
| Identity or target unresolved | its row is unverified, never successful |
| Tool only configured | its row is unverified until a read succeeds |
| Browser needed | its evidence names the application and visible content read |
| Database checked | only metadata was read |
| Run completes | no data, configuration or memory file changed |
