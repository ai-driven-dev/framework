# Phase 2: autonomous skill

Status: done

Implement the plan's bounded request interface, canonical source, native adapters and safe contribution writer. Include create/update/delete/publish commands with explicit project and targets; no implicit host detection in the script. Resolve the installed script from the skill, not a framework checkout. Rewrite the existing CLI instructions rather than adding competing ones.

Focused tests must exercise actual child-process invocation, copied installed skill execution with no AIDD on PATH, an ESM host, native syntax, exact content, shared deduplication, deterministic ordering, CRLF/user-memory preservation, deletion of the final contribution, and refusal before mutation for invalid inputs, ownership ambiguity and unsafe filesystem targets. Regress the previous candidate's rendered-marker validation failure rather than relying on raw input validation.

CLI remains identical to pinned base. No unrelated project-memory, telemetry or host configuration changes.

Delivery evidence: [verification](verification.md), 41 focused tests and nine real translated asset executions. Final script SHA-256: 9fa10479a267d899a6a024f68e75573f1d009080cd60851f23f06c8f2d190591.
