---
status: historical-done-current-kilo-guidance-retained
---

# Phase 5: Kilo hook guidance without invented conversion

Historical instruction: [related historical commit](https://github.com/ai-driven-dev/framework/commit/826ad89b9b1f029eac92298838e646fc63c03a91). Historical status: `done`. Current scope status: Kilo-specific guidance retained; unrelated hook changes excluded.

## Architecture projection

- Explain that Kilo hooks use JavaScript/TypeScript plugins under `.kilo/plugin/` or `.kilo/plugins/`.
- Name lifecycle mappings only when the Kilo contract supports them.
- Do not emit Claude-style declarative hooks or invent equivalents for unsupported events.

Current implementation: `plugins/aidd-context/skills/08-hook-generate/`.

## Test Scope

Contract tests check Kilo guidance and absence of unsupported declarative output, including mixed-target behavior. These tests validate the guidance contract, not execution of a newly generated Kilo plugin.

## Tasks to do

- Historical: provide a terminal Kilo-specific explanation while preserving other supported targets. Marked `done` in the archived phase record.
- Current: keep only guidance required by #914; do not restore unrelated hook-engine or bridge refactors.

## Test acceptance criteria

| Criterion | Current evidence/status |
| --- | --- |
| Kilo-only request gives sourced plugin guidance and writes no unsupported hook artifact. | Hook generation contract tests. |
| Unsupported lifecycle mappings are stated as unsupported. | Contract/documentation checks. |
| Mixed target keeps supported hosts' contracts. | Existing hook-generation tests. |
| A generic Kilo runtime plugin is generated or validated here. | Out of scope and not claimed. |
