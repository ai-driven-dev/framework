# tools

What a tool declares: where its files land, how it takes plugins, what its plugin CLI says, what `aidd translate` builds for it. Language: `src/contexts/tools/glossary.md`. Procedure: [01-tool.md](../../actions/01-tool.md).

## Ports

- `ToolCatalog` (`contract/tool-catalog.ts`): the registered tools, asked by id or walked in a named order; `wireTools()` in `src/composition/contexts/tools.ts` builds it from `REGISTERED_PROFILES` in `src/composition/tool-profiles.composition.ts`.
- `AiToolProfile`, `IdeToolProfile` (`contract/tool-profile.ts`) and `ToolBuildContract` (`contract/build-contract.ts`): the answers a caller asks.

## Rules

- A profile is data (`defineAiTool`, `defineIdeTool`); it fetches and installs nothing. A missing section is a missing declaration. No `index.ts` barrel.
- Callers ask a profile a question and never read its structure (`answers` rule of `kinds.rules.arch.test.ts`); a new question is a method of `contract/tool-profile.ts`. A reader outside `tools` names the sections it reads in its own `ports/` (`whole-profile-import.grit`, `profile` rule).
- A class takes the catalog in its constructor (`shape` rule) and asks a profile a question.
- `ToolId` is opaque and carries no list: only profiles and `ToolCatalog` lookups mint one (`tool-addition-cost.arch.test.ts`, `no-profile-list.grit`).
- Outside callers import `contract/` only; Biome shuts `domain/` and `application/`. `src/composition/tool-profiles.composition.ts` and `src/composition/contexts/host-registration.ts` are the only readers of `domain/`.
- A string transform used by one profile stays in its folder; one used by two goes to `domain/formats/`.

## Tests

- `tests/contexts/tools/` mirrors the source, except the `hooks-runtime-*.integration.test.ts` suites at its root, which run each tool's hook runtime end to end. `profile-conformance.contract.ts` and `profile-file-conformance.contract.ts` in `testing/` hold what every profile must pass.

## Exceptions

- Native activation classes stay in `tools` as data (`domain/native-registration/`, `contract/native-registration-spec.ts`): moving them to `host-registration` needs a `tools` to `host-registration` edge the graph forbids.
- The host adapters' `EVENTS` tables (`assets/hooks-runtime/host-*.cjs`) copy the event fact: the adapters are plain Node and import nothing from the CLI; `profile-file-conformance.contract.ts` holds them equal to the descriptor.
- `kilo-hooks-bridge.model.ts` and `opencode-hooks-bridge.model.ts` each keep their own `runHook`, `stopReasonOf` and `answerOf` text, and opencode exports `stopCallsFor` and `postToolUseCallsFor` unread: they differ in behaviour (kilo reports a failed hook, opencode ignores it) and the golden freezes them.
- Per-tool `*.model.ts` files sit beside their profile: merging them into profile data is not done.
- `rewritePluginRootToken` lives in `contract/plugin-root-token.ts`, not `domain/formats/`, because `translate` calls it and reaches `tools` through `contract/` only.
