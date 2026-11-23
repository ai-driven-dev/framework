# Build contract

`aidd translate <source> --to <tool> --out <dir>` builds the Claude-format framework into a tool-native plugin tree (`--as marketplace`, the default) or a project workspace (`--as flat`). A tool declares its build behavior as one `ToolBuildContract` per mode, never as a new sink class; the single `DiskSink` in `translate` reads it for both modes.

## Artifact symmetry

- A plugin carries these artifact kinds: `skills`, `agents`, `mcp`, `hooks`, `rules`, `commands`.
- The contract holds one `ArtifactContract` per kind; a kind's own need is an optional field of that union (`rewriteSkillName`, `mcpServersKey`, `hooksFile`), never a per-kind method such as `transformAgent`.
- An unsupported kind is `{ supported: false }`: the build warns and skips it.
- A new tool behavior is a field on the contract, never a `tool` or `kind` branch in the sink.

## ArtifactContract fields

| Field | Role |
| --- | --- |
| `source` | `filteredTree`, `fullTree`, `configFile` or `hooksBundle`: where input files come from |
| `placement` | where one file lands, as data: `layout` (a flat skills or agents layout), `relative` (its path in the plugin), `file` (one shared file), `agentFiles` (`dir`, `ext`) or `hooks` (`scriptsDir`, `loaderEntry?`); `artifactPath` reads it |
| `transform?` | per-kind content transform, the identity by default |
| `mcpServersKey?` | merge into one shared config file, at the path the layout declares, instead of a per-plugin write |
| `hooksFile?` | the hooks file a plugin's `hooks.json` becomes, at `at`: `{shared}` for one file every plugin folds into, `{own}` for one per plugin; build its `merge` with `flatHooksArtifact` in `domain/formats/hooks/flat-routes.ts` |
| `script?`, `skipHooksJson?`, `hooksBridge?` | a tool's own hook script, delivery without `hooks.json`, and a generated event bridge, which names its `dir` |

- Contract level: the manifest trio (`manifestFileRelative`, `synthesizeManifest`, `manifestSchemaName`), `pluginRootToken`, `configArtifact`, and the two marketplace builders.
- The live field list is `contract/build-contract.ts`.

## Reuse

- Paths come from the profile's install path functions and the flat-path primitives in `shared/domain/materialization/flat-paths.ts`.
- Agent format, MCP and config merges come from the existing helpers in `domain/formats/`; add a parameter to one, never a parallel copy.
- A helper two tools' contracts share lives in `domain/marketplace-catalog.ts`, never inside one tool's folder.

## Where it lives

- `domain/profiles/<tool>/<tool>-build.model.ts` exports `build<Tool>Contract`, `build<Tool>MarketplaceContract` (copilot) or `build<Tool>FlatContract`.
- The profile lists them in `buildContracts: { marketplace?, flat? }`; a mode left out answers `null` from `buildContract(mode, provider)`.
- `createFrameworkBuildUseCase` in `composition/contexts/translate.ts` returns `undefined` for a pair with no contract, and `presentation/controllers/translate.controller.ts` reports it as an unsupported target and mode combination.
- The MCP namespacing rule is in `plugin-sections.md`.
