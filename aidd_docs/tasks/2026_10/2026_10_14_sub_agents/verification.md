# Sub-agent verification

Current state, 2026-10-23, after the review of #1027. Behavior and sources are in [the agent guide](../../../../docs/SUBAGENTS.md).

## Scope

- **Agents:** explorer, executor, validator and reviewer ship in `plugins/aidd-orchestrator/agents/`, installed with the plugin. No model is pinned.
- **Read-only:** explorer (`Read, Grep, Glob`) and validator (`Read, Grep, Glob, Bash`) declare a Claude Code `tools` allowlist. Copilot reads it through its aliases; the OpenCode build turns it into a V2 `permissions` rule denying `edit`; Codex, Cursor and Kilo drop it. The reviewer stays unrestricted because `/aidd-dev:05-review` writes its report.
- **Out of scope:** the `aidd agents` command, per-provider models and effort, and the reload opt-in moved to a follow-up change; the code is at `f7786c5`.

## Checks

- **Build output:** a flat build per host writes the expected frontmatter: Claude Code and Copilot keep `tools`, OpenCode gets the `permissions` rule, Codex and Cursor carry neither.
- **OpenCode runtime:** `opencode debug agents` loaded the four agents with a final `edit` rule of `deny` for explorer and validator, using the V1 `permission` map. The V2 `permissions` list now emitted is covered by unit tests only: after a restart, this environment stopped discovering project agents at all.

## Limits

Only the explorer is fully read-only; the validator keeps a shell, through which it can still write.
