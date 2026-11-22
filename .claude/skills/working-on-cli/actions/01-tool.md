# 01 - Add a tool, or follow a host's format change

Declare a tool as profile data, then prove the build and the host consume it.

## Input

The tool to add, or the host whose format changed.

## Output

A profile registered in one line, its goldens and fixtures current.

## Process

1. **Load.** Read [architecture.md](../references/architecture.md) and [tools.md](../references/contexts/tools.md). Section conventions, plugin delivery, content rewrite and the build contract are in `references/tool/`: [section-conventions.md](../references/tool/section-conventions.md), [plugin-sections.md](../references/tool/plugin-sections.md), [content-rewrite.md](../references/tool/content-rewrite.md), [build-contract.md](../references/tool/build-contract.md).
2. **Measure.** Read the host's current format from its own documentation or binary, never from memory. A measured quirk is comment material (`architecture.md`, Type honesty and comments).
3. **Declare.** For a new tool, create `src/contexts/tools/domain/profiles/<tool>/<tool>.profile.ts` with `defineAiTool` or `defineIdeTool` (`domain/profile/define-tool.ts`), and its format code beside it in `<tool>-*.model.ts`.
4. **Register.** Add one line to `REGISTERED_PROFILES` in `src/composition/tool-profiles.composition.ts`.
5. **Change a format.** Edit the profile or its `*.model.ts` only. A caller that needs a new answer gets a method on `contract/tool-profile.ts`, never a branch on the tool id.
6. **Hooks.** Declare them with `declareHooks`, or `declareBridgeHooks` for a bridge tool (`domain/bridges/event-bridge.ts`).
   - A host-hook tool adds `assets/hooks-runtime/host-<tool>.cjs` and one payload fixture per relayed event under `tests/fixtures/hooks-routes/<tool>/`.
7. **Conform.** Declared data gets no test of its own: `profile-conformance.unit.test.ts` walks `REGISTERED_PROFILES`.
   - A new rule over profiles is a conformance check in `tests/contexts/tools/testing/`, proven against a profile built to break it.
8. **Goldens.** Run `pnpm test:golden`; for output changed because the tool is new or its host changed, run `pnpm golden:update <name>` and read the diff before committing.
9. **Smoke.** Run `pnpm smoke`.

## Test

| Case | Pass |
| --- | --- |
| `pnpm test:golden` after the change | green, every diff explained by the new tool or host |
| `pnpm smoke` | the built binary exits 0 for the new tool |
| a tool id written in a second file | `tool-addition-cost.arch.test.ts` fails |
