# Tools glossary

The language of the `tools` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Profile | The declaration of one tool the CLI targets, an AI assistant or an editor. Only the factory builds one; a caller asks it questions | `defineAiTool`, `defineIdeTool`, `BuiltToolConfig`, `domain/profiles/<tool>/profile.ts` |
| Profile as asked | What an outside caller sees of a profile: answers, never structure | `AiToolProfile`, `IdeToolProfile`, `contract/tool-profile.ts` |
| Catalog | The registered profiles, asked by id or walked in one of two orders: registration order for help, sorted by id for setup and doctor. Built once, handed to every use case | `ToolCatalog`, `RegisteredToolCatalog`, `wireTools` |
| Registration list | The one list of profiles the catalog is built from; a new tool adds its line | `REGISTERED_PROFILES` |
| Contract | The only folder another context or presentation imports from `tools`: the answers, the catalog and the build contract | `contract/` |
| Section | One part a profile declares: agents, skills, commands, rules, mcp, hooks, plugins or config. A missing one is a missing declaration | `ProfileSections`, `domain/sections/` |
| Plugin delivery | How a tool takes plugins, asked through methods. It comes in three kinds | `pluginAnswers`, `HooksDelivery` |
| Native delivery | The tool installs a plugin through its own plugin CLI | `nativeLayout`, `NativePluginAnswers` |
| Flat delivery | The tool has the plugin's files injected into the project tree | `flatPlacement`, `FlatPluginAnswers` |
| Unsupported delivery | The tool takes no plugin | `LayoutSection` (mode unsupported), `UnsupportedPluginAnswers` |
| Build contract | What `aidd translate` needs of a tool to build its distribution: one artifact-symmetric declaration per build mode, read by translate's two mode-generic strategies | `ToolBuildContract`, `contract/build-contract.ts` |
| Flat layout | Where a flat plugin's files land and how its hooks are loaded | `FlatLayout`, `FlatSkillLayout` |
| Native activation | What a tool's own plugin CLI declares about itself: its binary, where it keeps its registries and cache, its settings file | `NativeActivation`, `NativeActivationAnswers` |
| Conformance | The checks every registered profile must pass, run over the registration list, so a new tool is checked without a test of its own | `PROFILE_CHECKS`, `PROFILE_FILE_CHECKS`, `tests/contexts/tools/testing/` |
