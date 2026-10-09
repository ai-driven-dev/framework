---
status: implemented
---

# Plan: OpenCode V2 rule discovery
## Overview
| Field | Value |
| --- | --- |
| Goal | Publish source rules as active OpenCode V2 project instructions while preserving user guidance. |
| Source | framework#913, reframed by the user to V2 only; [contract](./spec.md). |

## Phases
| # | Phase | File |
| --- | --- | --- |
| 1 | Safe rule publication and delivery | [phase-1.md](./phase-1.md) |
| 2 | Generation contract and real V2 verification | [phase-2.md](./phase-2.md) |

## Resources
| Source | Verified |
| --- | --- |
| [Official verification](./official-verification.md) | V2 ignores instructions entries and loads AGENTS.md. |
| cli/ARCHITECTURE.md | Tools declare host contracts; framework owns materialization; aidd-context produces project memory. |
| Existing rule installation, restoration and removal code | No existing Markdown block ownership; AGENTS.md must not be registered as a whole owned file. |
| Existing isolated OpenCode test installation | V2 2.0.22 and a local OpenAI-compatible capture harness are available. |

## Decisions
| Decision | Why |
| --- | --- |
| Target V2 only | Agreed scope after the official documentation invalidated the original contract. |
| Retain modular files as editable sources; publish their text in one bounded AGENTS.md block | V2 loads that native surface; a file link or instructions entry is insufficient. |
| Share one framework publication operation between direct generation and CLI lifecycle flows | Consistent safety, idempotence and stale-rule removal. Expose it through the existing rule command without requiring a manifest for direct generation. |
| Validate the block before any requested source mutation | Edited, duplicate or incomplete markers must fail without partial writes. Individual atomic writes are not a multi-file rollback. |
| Keep AGENTS.md outside whole-file ownership | Clean/removal must remove only an intact rule contribution. Project-memory content stays owned by aidd-context. |
| Declare scope predicates as instruction text | V2 has no documented native per-rule glob filter. |
| No new runtime dependency | Existing file ports, hashing and Markdown parsing suffice. |
| Document measured bundle growth under the existing budget policy | The base measures 733.98 KB against 734 KB. The new publication behavior adds about 9.5 KB; the final ceiling must leave at most about 2% headroom and record its measured cost in the existing budget registry. Do not compensate by changing unrelated features. |
| Tests first, independent review, real host capture | Generated files alone do not prove instruction discovery. |

## Delivery constraints
- Preserve the pre-existing .gitignore edit and .hermes.md.
- The user explicitly invoked SDLC in its default auto mode, authorizing its commit, push and draft-PR delivery. The orchestrator owns those VCS steps after the candidate is validated and independently reviewed; the executor must not commit or push.
- Run CLI lint, architecture, typecheck, type honesty, knip, the appropriate suites, build and project guards. Use targeted checks during implementation; final checks follow the repository completion requirements.
