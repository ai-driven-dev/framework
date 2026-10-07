---
status: implemented
---

# Plan: Load AIDD plugins in OpenCode V1 and V2

## Overview
| Field | Value |
| --- | --- |
| **Goal** | Generated context hooks and telemetry load and execute in OpenCode V2 while preserving V1 behavior. |
| **Source** | https://github.com/ai-driven-dev/framework/issues/953, its V1 compatibility comment, and the user's request for prior web research and real local tests. |

## Phases
| # | Phase | File |
| --- | --- | --- |
| 1 | Compatible plugin entrypoints and live verification | [phase-1.md](./phase-1.md) |

## Resources
| Source | Verified |
| --- | --- |
| https://opencode.ai/v2/docs/build/plugins/migrate-v1 | On 2026-10-07: default definition with id/setup for V2 and server for V1; object compatibility requires V1 1.18.29 or later. |
| https://opencode.ai/v2/docs/build/plugins | On 2026-10-07: setup receives location.directory; event.subscribe returns an asynchronous stream of events and takes an AbortSignal; cleanup cancels the stream. |
| https://opencode.ai/v2/docs | On 2026-10-07: @opencode/cli is the V2 package; version 2.0.22 exists in npm. |
| https://unpkg.com/@opencode/client@2.0.22/dist/promise/generated/types.d.ts | Released V2 events use data/location and granular tool/execution events. The live probe determines which declared events are actually emitted. |
| https://github.com/anomalyco/opencode/blob/v1.18.29/packages/opencode/src/plugin/index.ts | A recognized default.server is called once and the loader returns before its named-export fallback. |
| docs/ARCHITECTURE.md | Generic declarative hooks belong to the CLI bridge; telemetry retains its own journal adapter. No new runtime dependency is needed. |

## Decisions
| Decision | Why |
| --- | --- |
| Keep existing V1 factories and payload mapping; expose them through server on a default definition. | Preserve behavior and avoid running both entrypoints for one host. Verify against the actual V1 loader. |
| Emit one CLI-owned host adapter under .opencode/hooks, shared by both plugin definitions. | Keep protocol normalization and subscription lifecycle in one place, outside plugin discovery, while each plugin retains its own hook payload mapping. |
| Correlate V2 tool input/start, call and success events before reusing the V1 handler; map execution completion to turn-end. | The real 2.0.22 run emits granular events, not the declared content snapshots or session.idle. Tool names and inputs arrive before completion. Remove pending calls after success or failure. |
| Pin real tests to V1 1.18.29 and V2 2.0.22. | Covers the documented compatibility boundary and the failing V2 release named in the issue. |
| Run real hosts in fresh temporary profiles and projects against a local deterministic model endpoint. | Exercise actual plugin loading, events, memory refresh and journal writes without changing personal configuration or paying for inference. |
| Require observable hook effects, not only the absence of loader errors. | A successfully imported plugin can still do no work. |

## Constraints and risks
- No unrelated changes to the user's .gitignore or .hermes.md.
- No plugin-local test files: bundled hook tests remain in scripts/__tests__.
- Tests must fail before implementation for the entrypoint or behavior they name.
- V2 events may differ from V1; capture real events and preserve session identity and task declaration.
- OpenCode releases older than 1.18.29 do not support the documented default object contract; document the minimum instead of claiming untested backward compatibility.
