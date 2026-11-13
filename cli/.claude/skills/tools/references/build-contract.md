# Reference: ToolBuildContract — a tool's `aidd translate` behavior

`aidd translate <source> --to <target> --out <dir>` translates the Claude-format framework into
a tool-native plugin tree (`--as marketplace`, the default) or a project workspace
(`--as flat`). A tool's build behavior is declared by **one `ToolBuildContract`**, never by
writing a new strategy class. Two mode-generic orchestrators in `translate` consume it:

- `MarketplaceBuildStrategy(contract)` — emits the tool's marketplace plugin tree + catalog.
- `FlatBuildStrategy(contract)` — materializes content into a project workspace (per-plugin namespace).

Both implement the shared `BuildOutputStrategy` interface and iterate artifact kinds
**generically** — this is the `translate → tools` edge in practice: the orchestrator lives in
`translate`, reads a contract `tools` declared, and contains zero knowledge of any one tool.

## Artifact symmetry (the core rule)

A plugin carries six artifact kinds: `skills`, `agents`, `mcp`, `hooks`, `rules`, `commands`. The
contract exposes ONE `ArtifactContract` per kind — never a kind-specific field (no
`transformAgent`). Each kind is either:

- `{ supported: false }` → warn-and-skip (no native concept in this tool), or
- `{ supported: true, source, path, transform?, merge?, mergeDest?, mcpServersKey?, hooksFile?, skipHooksJson?, hooksBridge? }`.

The orchestrators contain **zero** `if (tool === …)` and **zero** `if (kind === "agents")`
branches. Adding a tool means writing its contract; adding tool-specific behavior means adding a
field to the contract — never a branch in an orchestrator.

## `ArtifactContract` fields

| Field | Role |
|---|---|
| `source` | where input files come from: `filteredTree` (e.g. agents `.md`), `fullTree` (skills), `configFile` (mcp `.mcp.json`), `hooksBundle` (hooks.json + scripts) |
| `path(plugin, relPath)` | output path for one file, extension included — reuse the profile's own `buildInstallPath`; the orchestrator adds the per-plugin namespace in flat mode |
| `transform?(content, plugin, basename)` | per-kind content transform; default is identity. Examples: strip `tools`/`color` frontmatter; markdown → TOML |
| `merge?` / `mergeDest?` / `mcpServersKey?` | for config-file kinds (mcp) merging into one shared file rather than a per-plugin write; reuse an existing merge helper, never reimplement |
| `hooksFile?` | the hooks file a plugin's hooks.json becomes: its `path`, whether every plugin `shared`s it, and the `merge` built from the tool's hooks descriptor by `flatHooksArtifact` (`domain/formats/hooks-descriptor.ts`; one engine, `domain/hooks/hooks-merge.ts`); never written by hand in a contract |

Contract-level: `manifestFileRelative` / `synthesizeManifest` / `manifestSchemaName`
(marketplace mode; each `null` when the tool has no native manifest), the optional
`pluginRootToken`, and an optional `configArtifact` (the tool's own config file, built once every plugin is written). Read
`contexts/tools/contract/build-contract.ts` for the live field list.

## Reuse, never reinvent

The tool profile already holds the per-tool knowledge — the contract wires it up:

- paths → the capability `buildInstallPath` functions + the generic flat-path primitives in `kernel/materialization/flat-paths.ts`.
- agent format → the tool's existing transform (markdown→TOML formatter, frontmatter-strip helper).
- mcp / config merges → the existing merge helper for that target format; generalize the helper
  (add a parameter) rather than write a parallel one.
- manifest synthesis → the shared Claude-style manifest synthesizer, where the tool adopts that shape.

A helper reused by more than one tool's contract (manifest/catalog shaping shared by
claude+cursor+copilot+codex) does not belong inside any one tool's directory — it lives in
`contexts/tools/domain/marketplace-catalog.ts`, next to `build-contract.ts`.

## MCP namespacing (correctness)

Every flat MCP merge must key-prefix servers by `<plugin>-`. Tools whose MCP config lives at a
primary location (not a per-plugin file) have no isolation otherwise — two plugins declaring a
server of the same name would collide. The prefix is mandatory for every tool.

## Where the contract lives, and how it reaches the pipeline

Each tool's contract(s) live in `contexts/tools/domain/profiles/<tool>/build.ts`, exporting
`build<Tool>Contract()` or `build<Tool>MarketplaceContract()` (marketplace — copilot uses the
second spelling) and/or `build<Tool>FlatContract()` (flat). The profile
declares which modes it supports via `buildContracts: { marketplace?, flat? }` in its
`defineAiTool` call — a tool with no native marketplace omits `marketplace`. A caller asks the
profile `buildContract(mode)`, which answers the contract or `null`.

`createFrameworkBuildUseCase` in `composition/translate.ts` asks the `ToolCatalog` it is handed
for the target's profile and its `buildContract(mode)`, then picks the mode-generic orchestrator
for it — there is no per-tool row to hand-add. A tool with no contract for the mode answers
`null`, and `presentation/commands/translate.ts` reports "Unsupported target/mode combination".
The tool id must still be added to `AiToolId` in `kernel/tool.ts`, which `FrameworkBuildTarget`
aliases: that names which targets exist at all, independent of which contracts they declare.
