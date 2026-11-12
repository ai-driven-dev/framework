---
name: tools
description: >
  Defines or modifies what the project targets, under src/contexts/tools/ — an AI/IDE tool
  profile, its build contract, the sections it declares (agents/skills/commands/rules/
  mcp/hooks/plugins/config) and its plugin delivery. Use when adding a new AI or IDE tool,
  changing what a tool declares, or declaring a tool's `aidd translate` build contract. Do NOT
  use for the canonical-to-native translation pipeline itself — use `translate`. Do NOT use for
  where plugin content comes from — use `distribution`. Do NOT use for manifest or install
  orchestration — use `framework`.
---

# Tools

`tools` is what the project targets and how each target is configured. Every AI assistant and IDE the CLI supports is one profile, declared in `contexts/tools/domain/profiles/<tool>/profile.ts` through `defineAiTool` or `defineIdeTool`. A profile is data and answers: it fetches and installs nothing. The context's language is `src/contexts/tools/glossary.md`; its rules are the `tools` page of the context rules, on the shape of `reference-context.md`.

## The model

- Outside callers import `tools/contract/` only, held by Biome. `domain/` and `application/` belong to the composition root.
- The catalog (`ToolCatalog`), built once in `composition/tools.ts` by `wireTools()`, is the port use cases receive. They ask it for a profile by id and never import one.
- A caller asks a profile a question (`plugins()?.requiresUserScope()`, `machineLocalFiles()`) and never reads its structure. A new question is a method on the answers in `contract/tool-profile.ts`.

## Add a tool

1. One folder `domain/profiles/<tool>/` with `profile.ts` (the declaration), and `build.ts` when the tool is a build target.
2. One line in `REGISTERED_PROFILES` (`domain/profiles/registered-profiles.ts`), AI tools before IDE tools.
3. The conformance suite (`tests/contexts/tools/testing/`) walks that list and checks the new profile: it has no test of its own for declared data.

A string transform used by one profile stays in its folder; one shared by two goes to `domain/formats/`. A missing section is a missing declaration.

## Conventions

- `rewriteContent(content)` is one way, per tool, with no reverse and no shared base helper. See `references/content-rewrite.md`.
- A section class ends in `Section`, takes one params object, keeps it in a private `#params`, throws `CapabilityConfigError` on an invalid combination. See `references/section-conventions.md`.
- Plugin delivery has three kinds, `native`, `flat` and `unsupported`. See `references/plugins-capability.md`.
- Build behaviour is one artifact-symmetric `ToolBuildContract` per tool and mode, read by the two mode-generic strategies in `translate`: never a per-tool strategy, never a per-tool branch in one. See `references/build-contract.md`.
- Follow the port/adapter and shared-module rules in `.claude/rules/00-architecture/`.
- No barrels: there is no `index.ts` and there never will be.

## How it's tested

- `tests/contexts/tools/` mirrors the source. A rule over what every profile declares is a conformance check; a profile's declared data gets no test.
- `tests/architecture/tool-addition-cost.arch.test.ts` guards the cost of adding a tool: a tool id appears only in its own profile, the registration list and the shared vocabulary.
- See the `test` skill for tier conventions.
