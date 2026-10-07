---
objective: "Project A can install or remove a plugin without changing foreign machine state or stranding A's local integration while B remains dependent."
status: in-progress
---

# Plan: #829 Check repairs

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Prove native catalogue ownership before host mutation; complete local cleanup before claim detach. |
| **Source** | [#829](https://github.com/ai-driven-dev/framework/issues/829), [`frame.md`](./frame.md), [`review.md`](./review.md) |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Guard native activation | [`phase-1.md`](./phase-1.md) |
| 2 | Finish project-local removal | [`phase-2.md`](./phase-2.md) |
| 3 | Prove current host source | [`phase-3.md`](./phase-3.md) |
| 4 | Preserve edited local integration | [`phase-4.md`](./phase-4.md) |
| 5 | Guard user-scope files | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| --- | --- |
| `codex plugin marketplace upgrade --help` | No name updates all configured Git marketplaces. |
| `copilot plugin marketplace update --help` | No name updates all registered marketplaces. |
| [`docs/ARCHITECTURE.md`](../../../../docs/ARCHITECTURE.md) | Host CLI calls stay behind the native activator port; application owns provenance. |

## Decisions

| Decision | Why |
| --- | --- |
| Refuse an unproven host catalogue; no `force` takeover | #829 requires preexisting user state untouched, including same-name collisions. |
| No unproven native legacy migration | Local registry scope normalization can continue; ambiguous host state is for manual reconciliation. |
| Skip automatic refresh of unproven project-labelled catalogues | A plugin claim does not prove machine catalogue ownership; preserve foreign state before optimizing refresh. |
| Local cleanup before machine claim detach | A failure must leave a truthful claim so retry cannot harm B. |
| A past machine claim is not current host source proof | Same-name catalogues can be repointed after AIDD registration; refuse host mutations without a current source witness. |
| Current source proof is not full ref ownership | An AIDD-owned catalogue can contain foreign host refs; read and partition host refs before unregistering it. |
| Compare local integration to install digests | Hooks and MCP in user-owned project files may be edited; never remove by name alone. |
| Compare user-scope files to install digests | Path containment is not ownership of current contents; edited files must not be updated or deleted by explicit user-scope operations. |
