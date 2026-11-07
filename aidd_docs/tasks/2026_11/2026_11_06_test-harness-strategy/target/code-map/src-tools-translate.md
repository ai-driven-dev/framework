# Code map: `src/contexts/tools` and `src/contexts/translate`

| Current | Target | Action | Note |
| --- | --- | --- | --- |
| `src/contexts/tools/domain/contracts.ts` | `src/contexts/tools/domain/profile.ts` | split | Has* replaced by typed optional sections; ToolCatalog contract in a new file |
| - | `src/contexts/tools/contract/tool-catalog.ts` | add | proposal: published read side (profiles, ids) consumed by translate, installation, host-registration |
| `src/contexts/tools/domain/build-contract.ts` | `src/contexts/tools/domain/profile.ts`; `src/contexts/translate/domain/source-refs.ts` | split | proposal: source-refs.ts name; section types to profile; SourceMarketplaceRef and SourcePluginEntryRef to translate |
| `src/contexts/tools/domain/registry.ts` | `src/contexts/tools/domain/catalog.ts`; `src/composition/tool-profiles/index.ts` | split | read side stays; registration becomes the single list |
| `src/contexts/tools/domain/capabilities/agents-capability.ts` | `src/contexts/tools/domain/sections/agents-section.ts` | rename | one section per artefact |
| `src/contexts/tools/domain/capabilities/commands-capability.ts` | `src/contexts/tools/domain/sections/commands-section.ts` | rename |  |
| `src/contexts/tools/domain/capabilities/rules-capability.ts` | `src/contexts/tools/domain/sections/rules-section.ts` | rename |  |
| `src/contexts/tools/domain/capabilities/skills-capability.ts` | `src/contexts/tools/domain/sections/skills-section.ts` | rename |  |
| `src/contexts/tools/domain/capabilities/mcp-capability.ts` | `src/contexts/tools/domain/sections/mcp-section.ts` | rename |  |
| `src/contexts/tools/domain/capabilities/hooks-capability.ts` | `src/contexts/tools/domain/sections/hooks-section.ts` | merge | merged with the hooks part of plugins-capability |
| `src/contexts/tools/domain/capabilities/settings-capability.ts` | `src/contexts/tools/domain/sections/config-section.ts` | rename | proposal: config section per the target data table |
| `src/contexts/tools/domain/capabilities/config-refs.ts` | `src/contexts/tools/domain/sections/config-refs.ts` | move | proposal: config reference type kept next to the config section |
| `src/contexts/tools/domain/capabilities/plugins-capability.ts` | `src/contexts/tools/domain/sections/hooks-section.ts`; `src/contexts/tools/domain/sections/mcp-section.ts`; `src/contexts/tools/domain/sections/layout-section.ts`; `src/contexts/tools/domain/sections/manifest-section.ts`; `src/contexts/host-registration/domain/native-activation.ts` | split | proposal: layout-section.ts and manifest-section.ts split of the 25 fields; native activation to host-registration |
| `src/contexts/tools/domain/hooks-format.ts` | `src/contexts/tools/domain/hooks-format.ts` | keep |  |
| `src/contexts/tools/domain/plugin-translation-mode.ts` | `src/contexts/tools/domain/plugin-translation-mode.ts` | keep |  |
| `src/contexts/tools/domain/models/plugin-install-notice.ts` | `src/contexts/installation/domain/plugin-install-notice.ts` | move | proposal: installation if read only there, to verify |
| `src/contexts/tools/domain/formats/plugin-root-token.ts` | `src/contexts/tools/domain/formats/plugin-root-token.ts` | merge | absorbs translate plugin-root-token-rewrite |
| `src/contexts/tools/domain/formats/*` | `src/contexts/tools/domain/formats/*` | keep | format library; cursor-hooks-project-merge stays |
| `src/contexts/tools/domain/marketplace-catalog.ts` | `src/contexts/tools/domain/marketplace-catalog.ts` | keep | build-contract helper shared by claude and cursor; 02 decides tools over the open question in 04 |
| `src/contexts/tools/domain/marketplace-entry.ts` | `src/contexts/tools/domain/marketplace-entry.ts` | keep | proposal: companion of marketplace-catalog, same build-contract role |
| `src/contexts/tools/domain/marketplace-settings.ts` | `src/contexts/host-registration/domain/marketplace-settings.ts` | move | settings section type defined by host-registration |
| `src/contexts/tools/domain/marketplace-source-conflict.ts` | `src/contexts/host-registration/domain/source-conflict.ts` | move |  |
| `src/contexts/tools/domain/host-plugin-registration.ts` | `src/contexts/host-registration/domain/registration-answer.ts` | move |  |
| `src/contexts/tools/domain/mcp-launch-command.ts` | `src/contexts/tools/domain/formats/mcp-launch-command.ts` | move | proposal: 04 says host-registration but the file is a win32 MCP config transform (content format), not a registration |
| `src/contexts/tools/domain/ports/file-merger.ts` | `src/shared/ports/file-merger.ts` | move | used by several contexts |
| `src/contexts/tools/domain/ports/schema-validator.ts` | `src/shared/ports/schema-validator.ts` | move | used by several contexts |
| `src/contexts/tools/domain/ports/native-plugin-activator.ts` | `src/contexts/host-registration/ports/host-actions.ts` | move |  |
| `src/contexts/tools/domain/ports/host-plugin-registry-reader.ts` | `src/contexts/host-registration/ports/host-plugin-registry.ts` | move |  |
| `src/contexts/tools/domain/ports/host-marketplace-registry-reader.ts` | `src/contexts/host-registration/ports/host-marketplace-registry.ts` | move |  |
| `src/contexts/tools/domain/ports/native-marketplace-source-reader.ts` | `src/contexts/host-registration/ports/host-marketplace-sources.ts` | move |  |
| `src/contexts/tools/domain/profiles/antigravity/profile.ts` | `src/composition/tool-profiles/antigravity.ts` | move | one file per tool; registered in tool-profiles/index.ts |
| `src/contexts/tools/domain/profiles/claude/profile.ts` | `src/composition/tool-profiles/claude.ts` | move | one file per tool; registered in tool-profiles/index.ts |
| `src/contexts/tools/domain/profiles/codex/profile.ts` | `src/composition/tool-profiles/codex.ts` | move | one file per tool; registered in tool-profiles/index.ts |
| `src/contexts/tools/domain/profiles/copilot/profile.ts` | `src/composition/tool-profiles/copilot.ts` | move | one file per tool; registered in tool-profiles/index.ts |
| `src/contexts/tools/domain/profiles/cursor/profile.ts` | `src/composition/tool-profiles/cursor.ts` | move | one file per tool; registered in tool-profiles/index.ts |
| `src/contexts/tools/domain/profiles/kilo/profile.ts` | `src/composition/tool-profiles/kilo.ts` | move | one file per tool; registered in tool-profiles/index.ts |
| `src/contexts/tools/domain/profiles/opencode/profile.ts` | `src/composition/tool-profiles/opencode.ts` | move | one file per tool; registered in tool-profiles/index.ts |
| `src/contexts/tools/domain/profiles/vscode/profile.ts` | `src/composition/tool-profiles/vscode.ts` | move | one file per tool; registered in tool-profiles/index.ts |
| `src/contexts/tools/domain/profiles/antigravity/build.ts` | `src/composition/tool-profiles/antigravity.ts` | merge | build contract becomes a section of the profile; leftover logic to named formats |
| `src/contexts/tools/domain/profiles/claude/build.ts` | `src/composition/tool-profiles/claude.ts` | merge | build contract becomes a section of the profile; leftover logic to named formats |
| `src/contexts/tools/domain/profiles/codex/build.ts` | `src/composition/tool-profiles/codex.ts` | merge | build contract becomes a section of the profile; leftover logic to named formats |
| `src/contexts/tools/domain/profiles/copilot/build.ts` | `src/composition/tool-profiles/copilot.ts` | merge | build contract becomes a section of the profile; leftover logic to named formats |
| `src/contexts/tools/domain/profiles/cursor/build.ts` | `src/composition/tool-profiles/cursor.ts` | merge | build contract becomes a section of the profile; leftover logic to named formats |
| `src/contexts/tools/domain/profiles/kilo/build.ts` | `src/composition/tool-profiles/kilo.ts` | merge | build contract becomes a section of the profile; leftover logic to named formats |
| `src/contexts/tools/domain/profiles/opencode/build.ts` | `src/composition/tool-profiles/opencode.ts` | merge | build contract becomes a section of the profile; leftover logic to named formats |
| `src/contexts/tools/domain/profiles/antigravity/antigravity-paths.ts` | `src/composition/tool-profiles/antigravity.ts` | merge | path templates as data |
| `src/contexts/tools/domain/profiles/claude/claude-build-paths.ts` | `src/composition/tool-profiles/claude.ts` | merge | path templates as data |
| `src/contexts/tools/domain/profiles/codex/codex-paths.ts` | `src/composition/tool-profiles/codex.ts` | merge | path templates as data |
| `src/contexts/tools/domain/profiles/copilot/copilot-paths.ts` | `src/composition/tool-profiles/copilot.ts` | merge | path templates as data |
| `src/contexts/tools/domain/profiles/cursor/cursor-paths.ts` | `src/composition/tool-profiles/cursor.ts` | merge | path templates as data |
| `src/contexts/tools/domain/profiles/kilo/kilo-paths.ts` | `src/composition/tool-profiles/kilo.ts` | merge | path templates as data; double-config becomes ordered configCandidates |
| `src/contexts/tools/domain/profiles/opencode/opencode-paths.ts` | `src/composition/tool-profiles/opencode.ts` | merge | path templates as data |
| `src/contexts/tools/domain/profiles/claude/claude-agent.ts` | `src/composition/tool-profiles/claude.ts` | merge | frontmatter keys as data |
| `src/contexts/tools/domain/profiles/copilot/copilot-agent.ts` | `src/composition/tool-profiles/copilot.ts` | merge | frontmatter keys as data |
| `src/contexts/tools/domain/profiles/cursor/cursor-agent.ts` | `src/composition/tool-profiles/cursor.ts` | merge | frontmatter keys as data |
| `src/contexts/tools/domain/profiles/kilo/kilo-agent.ts` | `src/composition/tool-profiles/kilo.ts` | merge | frontmatter keys as data |
| `src/contexts/tools/domain/profiles/opencode/opencode-agent.ts` | `src/composition/tool-profiles/opencode.ts` | merge | frontmatter keys as data |
| `src/contexts/tools/domain/profiles/opencode/opencode-hooks-bridge.ts` | `src/contexts/tools/domain/bridges/event-bridge.ts`; `src/contexts/tools/domain/bridges/opencode-bridge-params.ts` | merge | proposal: params file name; common parsing and execution in event-bridge |
| `src/contexts/tools/domain/profiles/kilo/kilo-hooks-bridge.ts` | `src/contexts/tools/domain/bridges/event-bridge.ts`; `src/contexts/tools/domain/bridges/kilo-bridge-params.ts` | merge | proposal: params file name |
| `src/contexts/tools/domain/profiles/antigravity/antigravity-hooks.ts` | `src/contexts/tools/domain/behaviours/antigravity-hooks.ts` | move | proposal: named per-tool behaviour stays in tools; folder to confirm |
| `src/contexts/tools/domain/profiles/codex/codex-agent-toml.ts` | `src/contexts/tools/domain/behaviours/codex-agent-toml.ts` | move | proposal: named per-tool behaviour stays in tools; folder to confirm |
| `src/contexts/tools/domain/profiles/codex/toml.ts` | `src/contexts/tools/domain/behaviours/codex-toml.ts` | rename | proposal: named per-tool behaviour stays in tools; codex prefix made explicit |
| `src/contexts/tools/domain/profiles/codex/native-marketplace-source.ts` | `src/composition/tool-profiles/codex.ts`; `src/contexts/host-registration/infrastructure/source-list-parsers.ts` | split | arguments stay as profile data; parser to host-registration |
| `src/contexts/tools/domain/profiles/copilot/native-marketplace-source.ts` | `src/composition/tool-profiles/copilot.ts`; `src/contexts/host-registration/infrastructure/source-list-parsers.ts` | split | arguments stay as profile data; parser to host-registration |
| `src/contexts/tools/infrastructure/abstract-native-plugin-cli-adapter.ts` | `src/contexts/host-registration/infrastructure/cli-host-actions-adapter.ts` | merge |  |
| `src/contexts/tools/infrastructure/native-plugin-cli-adapter.ts` | `src/contexts/host-registration/infrastructure/cli-host-actions-adapter.ts` | merge |  |
| `src/contexts/tools/infrastructure/host-plugin-registry-reader-adapter.ts` | `src/contexts/host-registration/infrastructure/plugin-registry-readers.ts` | move |  |
| `src/contexts/tools/infrastructure/host-marketplace-registry-reader-adapter.ts` | `src/contexts/host-registration/infrastructure/marketplace-registry-reader.ts` | move |  |
| `src/contexts/tools/infrastructure/native-marketplace-source-reader-adapter.ts` | `src/contexts/host-registration/infrastructure/marketplace-source-readers.ts` | move |  |
| `src/contexts/tools/infrastructure/executable-on-path.ts` | `src/contexts/host-registration/infrastructure/executable-on-path.ts` | move | moves to the shared OS adapter if a second context uses it |
| `src/contexts/translate/domain/content-translator.ts` | `src/contexts/translate/domain/engine.ts` | split | form 1: pure engine translate(distribution, profile) to OutputFile list; class PluginContentTranslator disappears |
| `src/contexts/translate/domain/build-target.ts` | `src/contexts/translate/domain/targets.ts`; `src/contexts/translate/domain/canon-format.ts` | split | Claude path constants to canon-format |
| `src/contexts/translate/domain/canon.ts` | `src/contexts/installation/domain/canon.ts` | move | proposal: installation (or the orchestration reading it), to confirm in 04 |
| `src/contexts/translate/domain/plugin-distribution.ts` | `src/shared/domain/plugin-distribution.ts` | move | proposal: shared if 2 contexts import it, computation pending; otherwise stays in translate/contract |
| `src/contexts/translate/domain/plugin-format.ts` | `src/shared/domain/plugin-format.ts` | move | proposal: same rule as plugin-distribution |
| `src/contexts/translate/domain/plugin-translation-skip.ts` | `src/shared/domain/plugin-translation-skip.ts` | move | proposal: same rule as plugin-distribution |
| `src/contexts/translate/domain/formats/cursor-hooks.ts` | `src/contexts/tools/domain/formats/cursor-hooks.ts` | move | knowledge of one host |
| `src/contexts/translate/domain/formats/plugin-root-token-rewrite.ts` | `src/contexts/tools/domain/formats/plugin-root-token.ts` | merge |  |
| `src/contexts/translate/application/translate-source.ts` | `src/contexts/translate/application/build-native-tree.ts` | rename | proposal: build command per the command convention, class BuildNativeTree; canon read feeds the engine |
| `src/contexts/translate/application/shared-plugin-helpers.ts` | `src/contexts/translate/application/shared-plugin-helpers.ts` | keep |  |
| `src/contexts/translate/application/strategies/build-output-strategy.ts` | `src/contexts/translate/application/sinks/disk-sink.ts` | merge | disk sink replaces the strategies |
| `src/contexts/translate/application/strategies/flat-build-strategy.ts` | `src/contexts/translate/application/sinks/disk-sink.ts` | merge | flat rules move into the engine; output guard and writing stay in the sink |
| `src/contexts/translate/application/strategies/marketplace-build-strategy.ts` | `src/contexts/translate/application/sinks/disk-sink.ts` | merge | manifest, catalogue and schema check stay in the sink |
| `src/contexts/translate/application/strategies/plugin-source-tree-reader.ts` | `src/contexts/translate/application/sinks/canon-tree-reader.ts` | rename | proposal: reads the canon from disk to feed the engine |
| `src/contexts/translate/application/strategies/write-skill-tree.ts` | `src/contexts/translate/application/sinks/disk-sink.ts` | merge | proposal: skill writing folded into the disk sink |
| `src/contexts/translate/infrastructure/schema-validator.ts` | `src/shared/infrastructure/schema-validator.ts` | move | Ajv adapter, 2 contexts use it |
| - | `src/contexts/translate/application/translate-distribution.ts` | add | proposal: command exposing the engine to installation (list sink, no sink code) |
| - | `src/contexts/translate/contract/output-file.ts` | add | proposal: OutputFile shape published to installation; exact fields to fix |
