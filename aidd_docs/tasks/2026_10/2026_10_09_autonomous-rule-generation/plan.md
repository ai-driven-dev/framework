# Autonomous rule generation plan

Status: implemented and independently accepted

## Design
Knowledge production stays in the rule-generation skill. Bundle a self-contained CommonJS Node script under its scripts directory, with built-ins only. The existing translation strategies already copy non-Markdown skill assets; no CLI packaging modification is needed.

An explicit JSON request carries category, slug, description, optional paths and the complete Markdown body. Confirmed targets are explicit invocation arguments. Project canonical sources live in aidd_docs/rules/<category>/<slug>.md, with a strict script-owned JSON metadata comment and an unchanged Markdown body. This avoids parsing arbitrary YAML or maintaining conflicting Codex/OpenCode source copies. Metadata records the rule's selected targets; publication includes only sources selected for Codex or OpenCode.

Render Claude paths arrays, Cursor description/globs/alwaysApply, and Copilot applyTo from the same request. Preserve the existing category and naming conventions. Codex/OpenCode use a single deterministic, signed aidd_rules contribution in root AGENTS.md, preserving every byte outside the owned contribution. In-file scopes are model guidance. Native-host file edits and edited contributions are refused rather than overwritten silently. Plugin-source mode retains canonical plugin Markdown authoring without host fan-out.

Preflight canonical sources and all requested destinations, including existing symlink ancestors, before any write or deletion. Refuse root AGENTS.override.md when targeting Codex because it would mask AGENTS.md. Guard local AGENTS.md against Codex's default 32 KiB cap, while documenting that global and ancestor guidance also consume the combined limit. Do not change host configuration. Legacy sources are not imported or deleted automatically.

## Delivery phases
1. [Remove the CLI mechanism](phase-1.md): completed, pinned base 12777d03.
2. [Implement and validate the autonomous skill](phase-2.md): executor owns script, rule skill documentation, explore mapping and focused root tests. Parent owns task artifacts and runtime capture.
3. [Verify and deliver](phase-3.md): repository checks, fresh V2 runtime evidence, independent review/challenge, then update draft #979.

## Evidence limits
Adapter tests prove native file syntax, not runtime use by all five hosts. Fresh V2 captures prove actual consumption on the exercised version/platform. Codex follows the documented instruction chain and precedence. Other hosts can also discover AGENTS.md; physical deduplication within that file does not guarantee context deduplication across native surfaces. Write preflight rejects validation failures before mutation; individual atomic file replacement is not a multi-file transaction against disk failures or concurrent edits.
