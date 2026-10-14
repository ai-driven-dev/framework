# 04 - Sync

Wire the memory into the tools the user picks.

## Input

The memory bank in `aidd_docs/memory/`.

## Output

Each picked tool's context file, carrying the memory block and available agent table.

## Process

1. **Require.** Stop unless `aidd_docs/memory/` holds a `.md`, sending the user to write the memory first.
2. **Detect.** Find the AI tools present per [tools.md](../references/tools.md).
3. **Pick.** Show every tool, the detected ones ticked, and wait for one or several.
4. **Upsert.** Ensure each picked tool's context file carries the block, per [tools.md](../references/tools.md).
   - Absent file: create it from [AGENTS.md](../assets/templates/AGENTS.md).
   - Its AIDD structure differs: offer to reconcile it, applying only what the user approves.
5. **Fill.** Run `hooks/update_memory.js` from the project root, naming the picked tools, and stop on a non-zero exit.
   - No script, the skill shipped alone: write each block from the bank.
6. **Agents.** Inspect the picked tools' available agent definitions and registration. Fill or replace only `aidd_agents:start` / `aidd_agents:end` with a `name | role` table.
   - List only installed, invocable agents. Use their actual host identities, including plugin namespaces or flat prefixes; never assume a short role name is callable everywhere.
   - Write short English descriptions beginning with the role's action verb. Keep detailed contracts in the agent definitions.
   - When tools share a context file, label differing identities by host. Omit unavailable roles; leave only the table header if no agents are available.
   - Preserve all user text outside the managed markers. Add the block when absent; do not add a discovery script or session hook.
7. **Verify.** Read each picked tool's block back and compare it to the bank.
   - A file in one and not the other: the fill did not land, report it and stop.

## Test

| Case | Pass |
| --- | --- |
| Empty bank | no context file created, the run stops |
| Script | it exits `0` |
| Picked tool | its block lists every root `.md` except `README.md`, nothing else |
| Bank grew | the block gains that file and keeps the rest |
| Unpicked tool | its context file is unchanged |
| Agent table | every row resolves to an installed agent on its labelled host |
| Agent unavailable | no row advertises it |
| Existing context | text outside managed blocks is preserved |
