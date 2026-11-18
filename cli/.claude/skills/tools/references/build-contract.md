# Build contract

`aidd translate <source> --to <tool> --out <dir>` builds the Claude-format framework into a tool-native plugin tree (`--as marketplace`, the default) or a project workspace (`--as flat`). A tool declares its build behavior as one `ToolBuildContract` per mode, never as a new sink class; the single `DiskSink` in `translate` reads it for both modes.

## Artifact symmetry

- A plugin carries six artifact kinds: `skills`, `agents`, `mcp`, `hooks`, `rules`, `commands`.
- The contract holds one `ArtifactContract` per kind and no kind-specific field, so there is no `transformAgent`.
- An unsupported kind is `{ supported: false }`: the build warns and skips it.
- A new tool behavior is a field on the contract, never a `tool` or `kind` branch in the sink.

## ArtifactContract fields

| Field | Role |
| --- | --- |
| `source` | `filteredTree`, `fullTree`, `configFile` or `hooksBundle`: where input files come from |
| `path(plugin, relPath)` | output path of one file; reuse the profile's own install path, the sink adds the plugin namespace in flat mode |
| `transform?` | per-kind content transform, the identity by default |
| `merge?`, `mergeDest?`, `mcpServersKey?` | merge into one shared config file instead of a per-plugin write |
| `hooksFile?` | the hooks file a plugin's `hooks.json` becomes; build its `merge` with `flatHooksArtifact` in `domain/formats/hooks-descriptor.ts` |
| `script?`, `skipHooksJson?`, `hooksBridge?` | a tool's own hook script, delivery without `hooks.json`, and a generated event bridge |

- Contract level: the manifest trio (`manifestFileRelative`, `synthesizeManifest`, `manifestSchemaName`), `pluginRootToken`, `configArtifact`, and the two marketplace builders.
- The live field list is `contract/build-contract.ts`.

## Reuse

- Paths come from the profile's install path functions and the flat-path primitives in `shared/domain/materialization/flat-paths.ts`.
- Agent format, MCP and config merges come from the existing helpers in `domain/formats/`; add a parameter to one, never a parallel copy.
- A helper two tools' contracts share lives in `domain/marketplace-catalog.ts`, never inside one tool's folder.

## Where it lives

- `domain/profiles/<tool>/build.ts` exports `build<Tool>Contract`, `build<Tool>MarketplaceContract` (copilot) or `build<Tool>FlatContract`.
- The profile lists them in `buildContracts: { marketplace?, flat? }`; a mode left out answers `null` from `buildContract(mode)`.
- `createFrameworkBuildUseCase` in `composition/translate.ts` asks the catalog for that contract; a tool with none for the mode gets "Unsupported target/mode combination".
- The MCP namespacing rule is in `plugin-sections.md`.
