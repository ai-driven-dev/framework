# Add a tool, or follow a host's format change

Load `references/architecture.md` and `references/contexts/tools.md`. Section conventions, plugin delivery, content rewrite and the build contract: `references/tool/`.

1. Read the host's current format from its own documentation or binary, never from memory. Measured quirks are comment material (`references/architecture.md`, Comments).
2. New tool: create `src/contexts/tools/domain/profiles/<tool>/<tool>.profile.ts`, built with `defineAiTool` or `defineIdeTool` (`domain/profile/define-tool.ts`). Per-tool format code sits beside it in `<tool>-*.model.ts`.
3. Add one line to `REGISTERED_PROFILES` in `src/composition/tool-profiles.composition.ts`. The id is written once, in the profile: `tool-addition-cost.arch.test.ts` refuses it anywhere else.
4. Format change: edit the profile or its `*.model.ts` only. A caller that needs a new answer gets a method on `contract/tool-profile.ts`, never a branch on the tool id.
5. Hooks: the profile declares them with `declareHooks`, or `declareBridgeHooks` for a bridge tool (`domain/bridges/event-bridge.ts`). A host-hook tool adds `assets/hooks-runtime/host-<tool>.cjs` and one payload fixture per relayed event under `tests/fixtures/hooks-routes/<tool>/`.
6. Declared data gets no test of its own: `tests/contexts/tools/domain/profiles/profile-conformance.unit.test.ts` walks `REGISTERED_PROFILES`. A new rule over profiles is a conformance check in `tests/contexts/tools/testing/`, proven against a profile built to break it.
7. Run `pnpm test:golden`. Output that changed because the tool is new or its host changed: `pnpm golden:update <name>`, then read the diff before committing.
8. Run `pnpm smoke`: unit and integration tests prove the output shape, never that the host consumes it.
