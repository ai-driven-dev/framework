---
status: implemented
---

# Plan: Emit plugin Rules in Kilo flat builds

## Overview
| Field | Value |
| --- | --- |
| **Goal** | `aidd framework build --target kilo --flat` materializes all-files plugin Rules under `.kilo/rules/` and references them from the resolved `kilo.json[c].instructions`. |
| **Source** | GitHub issue ai-driven-dev/framework#868 |

## Phases
| # | Phase | File |
| --- | --- | --- |
| 1 | Flat Rule emission for Kilo | [`phase-1.md`](./phase-1.md) |
| 2 | Kilo `instructions` merge and installed-archive proof | [`phase-2.md`](./phase-2.md) |

## Resources
| Source | Verified |
| --- | --- |
| https://kilo.ai/docs/customize/custom-rules | Project Rules are file paths or globs in `kilo.jsonc` `instructions`, written project-root relative (`.kilo/rules/x.md`); `.kilo/rules/` is the documented Rules directory. |
| `cli/src/contexts/tools/domain/profiles/kilo/build.ts` | `buildKiloFlatContract()` declares `rules: { supported: false }`; `emitConfigArtifact` already resolves and rewrites the Kilo config via `buildOpencodeFlatConfig`. |
| `cli/src/contexts/tools/domain/formats/opencode-mcp-merge.ts` | `buildOpencodeFlatConfig(base, existing, incoming, mergedKeys)` already appends base array values after existing ones, skipping duplicates: the `instructions` merge seam. |
| `cli/src/contexts/translate/application/translate-source.ts` | Builds call `writeAgents/Skills/Hooks/Mcp` only; `rules` is in `OUT_OF_SCOPE_PLUGIN_SECTIONS` and always warned as skipped. |
| `cli/src/contexts/translate/application/strategies/flat-build-strategy.ts` | Owns flat file writing, collision checks, and relative-link rewriting; no rule writer exists. |
| `cli/tests/fixtures/framework/plugins/aidd-test/rules/01-standards/naming.md` | Canonical Rules nest under `rules/<group>/` and scope with `paths` frontmatter. |
| `which kilo` | No Kilo binary on this machine: the real-runtime e2e (`tests/e2e/kilo-runtime.e2e.test.ts`) cannot run locally. |

## Decisions
| Decision | Why |
| --- | --- |
| Generic `writeRules` on `BuildOutputStrategy`, consuming `contract.artifacts.rules`. | Keeps file emission in the flat strategy, the seam #789 (OpenCode) can reuse; marketplace strategy returns 0. |
| Flat Rule path `.kilo/rules/<plugin>-<rel path with / as ->.md`. | Plugin prefix + flattened group path is collision-free and deterministic, matching the existing flat naming convention. |
| Path-scoped Rule rejection lives in the Kilo Rule transform, throwing a named domain error. | Scope support is a Kilo capability, not a generic flat one; transform already runs per Rule with plugin and name. |
| `instructions` merge reuses `buildOpencodeFlatConfig` `mergedKeys`. | Existing user entries keep order; generated entries append sorted and are never duplicated, giving idempotence for free. |
| The skipped-section warning fires only when the target does not support that section. | Kilo now ships rules; other targets keep the current warning. |
