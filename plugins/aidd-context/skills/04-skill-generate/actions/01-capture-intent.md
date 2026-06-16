# 01 - Capture intent

Clarify what the user wants before any file is touched.

## Input

A free-form request to create or modify a skill.

## Output

In-context decisions, nothing written yet:

- generate or modify
- the skill name and domain (tool or activity)
- what it produces, in one sentence
- the flow shape (chain or independent actions)
- whether it delegates to an agent
- the invocation mode (automatic or manual)
- the write mode: a host project (with its confirmed and blocked tools), or a plugin source under `plugins/<plugin>/skills/`

Plus a table of existing skills with overlap alerts.

## Process

1. **Gate.** Run the asset-access precheck (`@../references/tool-paths.md`).
2. **Generate or modify.** Ask: generate a new skill, or modify an existing one?
3. **Inventory.** List project and global skills across the detected tools. Print each name and its first description line.
4. **Scope.**
   - New: ask the single purpose in one sentence. Split if it spans domains.
   - Modify: confirm the target, read its SKILL.md + actions, capture what to change, set tools and location from where it lives (every host copy, or the one named), continue at 02 (gate skipped).
5. **Name.** Pick the domain. Validate the name against `@../references/skill-authoring.md`.
6. **Overlap.** Block a duplicate name. On a trigger or MCP overlap, ask to merge, rename, tighten, or abort.
7. **Shape.** Ask the flow shape (chain or independent), whether it delegates to an agent, and the invocation mode.
8. **Write mode.** Ask where the skill goes:
   - **Host project**: detect the installed tools (`@../references/tool-paths.md`), propose them, and confirm which to target. Automatic mode takes the detected set. A fresh repo proposes every supported tool. Never pick one silently.
   - **Plugin source**: confirm or create `plugins/<plugin>/skills/`.

## Test

- Every decision is stated and confirmed in writing.
- The target scope and base are set before any write.
- The cross-tool inventory was shown.
- Every overlap was surfaced or noted as none.
