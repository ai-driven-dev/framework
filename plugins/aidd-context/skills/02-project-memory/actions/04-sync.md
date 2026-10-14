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
   - **Absent:** create it from [AGENTS.md](../assets/templates/AGENTS.md).
   - **Different:** reconcile its AIDD structure only with approval.
5. **Fill.** Run `hooks/update_memory.js` from the project root, naming the picked tools, and stop on a non-zero exit.
   - **Standalone:** without the script, fill each block from the bank.
6. **Agents.** Fill `aidd_agents:start` / `aidd_agents:end` with installed, invocable agents and short English verb-led roles; label differing names by host in shared files.
7. **Verify.** Read back each selected block; stop if it differs from the bank or advertises an unavailable agent.

## Rules

- **Memory:** list every root `.md` except `README.md`.
- **Preserve:** leave unselected tools and text outside managed blocks unchanged.
- **Missing block:** add the agent block, even if only its table header; no new discovery hook or script.
