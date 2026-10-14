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
4. **Report.** Fill [connection-report.md](../assets/connection-report.md) from the observed results.
   - A configured tool alone never proves access.
   - A successful read never proves write permissions.
   - Keep these session results out of the durable memory bank.

## Test

| Case | Pass |
| --- | --- |
| Declared service | its row names the tool, account, target and observed read |
| Required access missing | its row reports failure and the next action |
| Read fails | its row reports the error and other services are still checked |
| Identity or target unresolved | its row is unverified, never successful |
| Tool only configured | its row is unverified until a read succeeds |
| Browser needed | its evidence names the application and visible content read |
| Database checked | only metadata was read |
| Run completes | no data, configuration or memory file changed |
