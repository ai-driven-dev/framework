# Target: the `tools` and `translate` contexts

Scope: `cli/src/contexts/tools` (77 files: 37 domain files outside profiles, 34 profile files, 6 infrastructure files) and `cli/src/contexts/translate` (16 files, 1661 lines), with their tests. What is not verified is said so (end of document).

Where this document disagrees with `00-overview.md`, the overview wins. Decisions taken there and applied here: translation shape is form 1 (one pure engine, two sinks); one profile file per tool in `composition/tool-profiles/` plus one registration list; scenarios live in `orchestration/` (`framework`, `runtime` disappear, `kernel` becomes `shared`); cross-context imports only through the target's `application/` and `contract/`; use cases become commands; per-profile mutation scopes disappear.

Team hypothesis: `translate` is an agnostic engine, `tools` carries agnostic contracts plus per-tool specifics, a sixth tool costs one file and one line. Verdict: right as an intention, wrong as a current state. Neither context is agnostic (sections 1 and 3); adding Kilo touched 13 files outside its profile, adding Antigravity 10. The target below makes the intention true.

## 1. The `tools` context (target: content profiles of the hosts)

### Purpose and boundary

One question: how does a host expect its content (skills, agents, commands, rules, hooks, MCP, manifest, config)? Single reason to change: a host changes its format, or one is added. `tools` does not install, does not register anything with a native registry, reads no session log: the 6 current infrastructure files, which drive host CLIs, move out to `host-registration`.

Context map: `translate -> tools`, `host-registration -> tools`, `installation -> tools`. `tools` imports no other context. Others reach `tools` only through its `application/` and `contract/`.

### Ubiquitous language

| Term | Meaning |
| --- | --- |
| Profile | declaration of a host: data per section, named behaviours |
| Section | part of a profile per artefact (skills, agents, commands, rules, hooks, mcp, manifest, config) |
| Layout (`layout`) | rule computing the output path: nested, single level, folder per agent |
| Hooks delivery | `plugin-file`, `project-merge`, `bridge` or `none` |
| Named format | transformation from the format library, referenced by identifier |
| Merge strategy | rule for adding into a shared file: `user-prime`, `framework-prime`, `none` |
| Hooks bridge | module generated in the host that replays hooks for lack of a native `hooks.json` |
| Conformance | single suite run on every registered profile |

### Model

| Element | Current source | Note |
| --- | --- | --- |
| `AiTool<C>`, `Has*` | `tools/domain/contracts.ts:1-87` | typed capabilities; `hasRules` tests for the presence of a key |
| `ToolBuildContract`, `ArtifactContract` | `tools/domain/build-contract.ts:15-157` | 6 artefacts, 4 sources, 8 optional function fields |
| `PluginsCapability` | `tools/domain/capabilities/plugins-capability.ts:161-194` | more than 25 fields: mode, hooks, bridge, `flatSkillLayout`, native activation, marketplace |
| Registry | `tools/domain/registry.ts:62-70` | global `Map` filled by side effect (`registerTool` at the bottom of each `profile.ts`) |
| Identifiers | `kernel/tool.ts:3-28` | literal union + arrays |
| Config assets | `runtime/assets/asset-loader.ts:24-39` | `Record<ToolId, ...>`: an empty entry (`antigravity: {}`) is required |

Contract gaps revealed by Kilo and Antigravity (G1 to G8):

| # | Gap | Evidence |
| --- | --- | --- |
| G1 | Flat skills layout declared twice: `flatSkillLayout` enumeration read by installation, `path` function in the build contract | `antigravity/profile.ts:45`, `content-translator.ts:371` (hard-coded template), `antigravity/build.ts:15` |
| G2 | Hooks bridge declared twice, field for field | `kilo/profile.ts:95-99`, `kilo/build.ts:111-116` |
| G3 | Merge: functions on the build side (`merge`, `mergeDest`, `hooksMerge`, `hooksMergeDest`), `mergeStrategy` string on the installation side read by a dedicated branch | `install-runtime-config-use-case.ts:110` |
| G4 | Double config: ad hoc function and named error in the kernel, no "ordered candidates, conflict = error" field | `kilo/kilo-paths.ts:21-37`, `kernel/errors.ts:140`, inline version `opencode/profile.ts:96` |
| G5 | Config path resolved in three places | `kilo/profile.ts:44` (`configOutputPaths`), `:87` (`resolveOutputPath`), `kilo/build.ts:99` |
| G6 | The build recomputes MCP separately instead of reusing the MCP capability | `kilo/build.ts:60-74` (`collectKiloMcp`) |
| G7 | Four manual registrations: `kernel/tool.ts`, `asset-loader`, three profile imports | `runtime/wiring/{tools,framework,translate}.ts`, 8 imports each |
| G8 | Extension without mechanism: `FlatSkillLayout` added for a single tool, `single-level` branch in the translator | `content-translator.ts:371` |

### Target contract: data versus behaviours

A fact about the host is serializable data, comparable in a snapshot. A function exists only when the fact cannot be expressed as data; it is then named, referenced by identifier and tested alone.

| Family | As data (profile field) | Stays behaviour |
| --- | --- | --- |
| Identity | `id`, `displayName`, `directory`, `toolSuffix`, `signalDir`, `kind` | none |
| Layout per artefact | `layout` (`nested`, `single-level`, `dir-per-item`), `pathTemplate` (`{dir}` `{plugin}` `{rel}`), `ext`, `renameSkillAfterFolder` | none: the template replaces the `path` functions |
| Hooks | `hooksDelivery`, `hooksDest`, `hooksShape` (`matchers`, `flat`), `scriptsDir`, `bridge: { format, path, skipIfSourceHas }` | bridge generator, project merge (named formats) |
| MCP | `format`, `section`, `serversKey`, `mergeStrategy`, `configCandidates` (ordered), `onMultipleCandidates` (`error`, `first`) | converter to the host format |
| Manifest, catalogue | path, schema name or `null` | `synthesize`, `buildEntry`, `buildCatalog` |
| Plugin root token, distribution probes | values | none |
| Shipped config | `configAssets: [{ name, destination }]` (replaces `asset-loader`) | final emission (Codex TOML, OpenCode) |
| Frontmatter | kept, renamed, forbidden keys | non-trivial conversion (Codex agent to TOML) |

Decided: a profile is ONE file per tool, in `composition/tool-profiles/`, exporting one object per section, plus one registration list. Each section type is defined by the context that reads it (content: `tools`; native registration: `host-registration`); assembly happens in `composition`, which avoids a `tools -> host-registration` edge. Adding a tool is one profile file plus one line in the registration list. A conformance suite runs on every registered profile, so adding a tool adds no test file.

Invariants of a profile, all mechanically testable:

| # | Invariant |
| --- | --- |
| I1 | Unique `id`, present in the single registration list, equal to its registry key |
| I2 | `directory` relative and ending in `/`; no produced path leaves `directory` or a declared root |
| I3 | Each artefact is either supported with a layout, or unsupported with a displayable reason |
| I4 | Deterministic output (sorted files) |
| I5 | Two distinct plugins never collide; the same plugin twice gives the same bytes |
| I6 | No residual `${CLAUDE_PLUGIN_ROOT}` when a token is declared |
| I7 | Any produced JSON parses and validates against the vendored schema if one exists |
| I8 | A merge keeps the user's keys and redoes identically |
| I9 | Zero, one or several candidate config paths: behaviour fixed by `onMultipleCandidates`, never a host-specific exception |
| I10 | Paths A (build) and B (installation) produce the same set of files for the same distribution, up to declared gaps |

I10 makes the duality of section 2 measurable: it fails while the two paths diverge. Under form 1 (decided) it becomes true by construction, since both paths call the same engine; it stays as a cheap conformance check that the sinks add nothing (section 2, "Form 1 in detail").

### Services, commands, ports, adapters

| Heading | Content |
| --- | --- |
| Domain services | layout resolution (template to path, today the `path` functions of the `build.ts`; it reuses `flat-paths.ts`, which lives in `shared/domain/materialization/` because framework, tools and translate import it, as document 03 says); format library (`tools/domain/formats`, 10 files, about 1000 lines); pure derivations from the registry (`registry.ts:73-190`) |
| Commands owned | none: `tools` provides declarations, execution belongs to `translate` and `installation` |
| Ports owned | `ToolCatalog` (profiles, ids, derivations), published in `contract/tool-catalog.ts`, consumed by `translate`, `installation`, `presentation`, and `telemetry` for ids only |
| Ports moved | `JsonSchemaValidator`, `FileMerger` to `shared/ports` (used by several contexts); the 4 native registry ports to `host-registration/ports/` (a context's `ports/` sits beside its `domain/`, not inside it) |
| Adapters | none. Hosts remain external systems the project does not control; `tools` describes the files written to them and never contacts them |
| Dependencies | `shared/domain` and `shared/ports` only; neither `translate` nor `orchestration` |

### Tests

| Level | Content |
| --- | --- |
| Unit | one format or converter at a time, inputs collected from real hosts |
| Conformance | `profile-conformance`: I1 to I10 on every registered profile; fails if a profile is missing from registration; adding a tool adds no test file |
| Data snapshot | declarative part of each profile, explicit review on every change |
| Host boundary | section 6 |

A test must provide: a reference distribution with the six artefacts, two plugins, a `hooks.json` with one handled event and one unhandled, a `.mcp.json`, a pre-existing user config file, an in-memory file system, no mock of the profile.

### Enforceable rules

| Rule | Mechanism | Replaces |
| --- | --- | --- |
| No tool id outside the profile folder and the registration list | dependency-cruiser or Biome rule + string pattern | `tests/architecture/tool-addition-cost.arch.test.ts` (ratchet of 19 files, 5 of them telemetry readers) |
| `tools` imports no other context | import rule | orthogonality check of `check-architecture-rules.js` (coverage to confirm) |
| A profile exposes exactly the expected sections | strict typing + conformance | `registry-conformance.unit.test.ts` (320 lines), absorbed |
| The id union is derived from the registration array | single `as const` | `kernel/tool.ts` and the `asset-loader` table |

### Current to target mapping (under `cli/src/contexts/tools/`)

| Current path | Action | Target |
| --- | --- | --- |
| `domain/contracts.ts` | split | `domain/profile.ts`; `Has*` replaced by typed optional sections; `ToolCatalog` to `contract/tool-catalog.ts` (proposal) |
| `domain/build-contract.ts` | split | section types to `domain/profile.ts`; `SourceMarketplaceRef`, `SourcePluginEntryRef` to `translate/domain/source-refs.ts` (proposal: file name) |
| `domain/registry.ts` | split | `domain/catalog.ts` (read side); registration to `composition/tool-profiles/index.ts` |
| `domain/capabilities/` (9 files) | merge | `domain/sections/`, one per artefact; `plugins-capability.ts` broken up: native activation to `host-registration/domain/native-activation.ts`, the rest to the hooks, mcp, layout and manifest sections |
| `domain/hooks-format.ts`, `plugin-translation-mode.ts` | keep | `domain/` |
| `domain/models/plugin-install-notice.ts` | move | `installation` if read only there (to verify) |
| `domain/formats/` (10 files) | keep | `domain/formats/` (`cursor-hooks-project-merge.ts` stays, the only tolerated tool name, outside the baseline) |
| `domain/marketplace-catalog.ts`, `marketplace-entry.ts` | keep | `domain/`: build-contract helper shared by the claude and cursor profiles (decision 4) |
| `domain/marketplace-settings.ts` | move | `host-registration/domain/marketplace-settings.ts`: settings section type defined by its reading context |
| `domain/marketplace-source-conflict.ts`, `host-plugin-registration.ts` | move | `host-registration/domain/source-conflict.ts`, `registration-answer.ts` |
| `domain/mcp-launch-command.ts` | move | `domain/formats/mcp-launch-command.ts`: a Windows MCP config transform (content format), not a registration |
| `domain/ports/file-merger.ts`, `schema-validator.ts` | move | `shared/ports` |
| `domain/ports/{host-marketplace-registry-reader,host-plugin-registry-reader,native-marketplace-source-reader,native-plugin-activator}.ts` | move | `host-registration/ports/` (`host-marketplace-registry.ts`, `host-plugin-registry.ts`, `host-marketplace-sources.ts`, `host-actions.ts`) |
| `domain/profiles/<tool>/profile.ts` (8) | move | `composition/tool-profiles/<tool>.ts` |
| `domain/profiles/<tool>/build.ts` (7, about 1200 lines) | merge | section of the profile; remaining logic to named formats |
| `domain/profiles/*/*-paths.ts`, `*-agent.ts`, `claude-build-paths.ts` (13) | merge | templates and frontmatter keys as data in the profile |
| `domain/profiles/{opencode,kilo}/*-hooks-bridge.ts` | merge | `domain/bridges/event-bridge.ts` + 2 parameter files (section 4) |
| `domain/profiles/antigravity/antigravity-hooks.ts` | move | `domain/behaviours/antigravity-hooks.ts`: named behaviour of the tool, stays in `tools` (proposal: folder to confirm) |
| `domain/profiles/codex/{codex-agent-toml,toml}.ts` | move | `domain/behaviours/codex-agent-toml.ts`, `codex-toml.ts`: named behaviour of the tool, stays in `tools` (proposal: folder to confirm) |
| `domain/profiles/{codex,copilot}/native-marketplace-source.ts` | split | arguments stay as profile data in `composition/tool-profiles/<tool>.ts`; parser to `host-registration/infrastructure/source-list-parsers.ts` |
| `infrastructure/` (6 files) | move | `host-registration/infrastructure/`; `executable-on-path.ts` to the shared OS adapter if 2 contexts use it |

## 2. The `translate` context (target: engine from canon to a host)

### Purpose and boundary

Single reason to change: the source canon changes, or the way it is projected onto a profile changes. `translate` does not know where files land (that is `installation`) nor what a host is (that is `tools`). Today it is barely agnostic: it contains Claude, Cursor and Codex constants (section 3), and most of the translation logic lives in the profiles' `build.ts`.

Context map: `translate -> tools`. Other contexts call `translate` only through its `application/` and `contract/`.

### Ubiquitous language

| Term | Meaning |
| --- | --- |
| Canon | source format of the framework's plugins, today Claude's |
| Distribution | a plugin read: manifest, files, categorised components |
| Target, mode | a profile; `marketplace` (distribution tree) or `flat` (injection into a workspace) |
| Sink | destination: disk for the build, file list for installation materialisation |
| Skip | component deliberately not translated, with a displayable reason |

### Model

| Element | Current source | Note |
| --- | --- | --- |
| `PluginDistribution` | `translate/domain/plugin-distribution.ts` | imported by 18 files outside `translate`: canon vocabulary |
| `FrameworkDescriptor` | `translate/domain/canon.ts` | imported by 8 files of `framework`, none of `translate`: to bring home |
| Targets and modes | `translate/domain/build-target.ts:1-78` | derived from the registry; mixes in Claude path constants (`:67`, `:70`) |
| `BuildOutputStrategy` | `translate/application/strategies/build-output-strategy.ts` | 6-method interface (path A) |
| `PluginContentTranslator` | `translate/domain/content-translator.ts` (491 lines) | path B |

### The two paths and their overlap

Path A, build: `FrameworkBuildUseCase` (134 lines) reads the canon on disk and calls a strategy (`FlatBuildStrategy` 368, `MarketplaceBuildStrategy` 178) that reads the profile's build contract and writes. Callers: `aidd translate`, `aidd sync`, `ensure-built-marketplace-use-case.ts`.
Path B, materialisation: `PluginContentTranslator` takes an in-memory `PluginDistribution` and the profile, and renders `InstallationFile[]` through the capabilities. Callers: 5 files of `framework` (install, add, update, restore).

| Step | A (build contract) | B (capabilities) | Duplicated |
| --- | --- | --- | --- |
| Skill path | `artifact.path` | `buildInstallPath` + `flatSkillLayout` | yes |
| Agent path | `artifact.path` | same; in flat mode B already calls `buildContracts.flat().artifacts.agents` | partial |
| Agent frontmatter | `artifact.transform` | `convertFrontmatter` | yes |
| Relative links | `rewriteRelativeLinks` | `tool.rewriteContent` (per-tool regex) | yes, two mechanisms |
| Plugin root token | `contract.pluginRootToken` | `plugins.pluginRootToken` | yes |
| Hooks file shape | `hooksTransform` (`copilot/build.ts:181`) | `convertHooksFormat` (`translate/domain/formats/cursor-hooks.ts`) | yes, at least two converters of the same family (equivalence not verified) |
| Hooks bridge, `skipIfSourceHas` rule | `writeHooksBridgeIfDeclared` | `flatHooksBridgeFile` | yes, coded twice |
| Hooks scripts copied as is | `writeFlatHooksScripts` | `flatHooksFiles` | yes |
| Rename of a skill's `name` | `rewriteSkillName` | not seen | to verify |
| MCP | `merge` + `mergeDest` | `transformContent` + flat materialiser of `framework` | yes |
| Collision in flat mode | `checkCollision` | `detectFlatCollisions` | yes |
| Manifest, catalogue, schema, output guard (`force`, non-empty folder) | A only | ignored (`PLUGIN_MANIFEST_PATHS`, `content-translator.ts:25`) or absent | no, intended asymmetry |

Input difference not to hide: A always starts from the canon; B starts from a distribution whose format is probed (Claude, Cursor, Codex, Copilot), so potentially already native. Verified in the code since the first draft: the translator branches on no source format, and `format` is read in one place only (the project-hooks materialiser). B therefore treats its input as canon.

### Shapes considered (form 1 decided)

| | Form 1 (decided): one pure engine, two sinks | Form 2 (rejected): two paths, shared core | Form 3 (rejected): B becomes A in memory |
| --- | --- | --- | --- |
| Idea | `translate(distribution, profile) -> OutputFile[]`; disk sink (build) and list sink (installation) | keep translator and strategies, extract `artifact-rules` (paths, token, hooks shape, bridge, rename) | installation runs the build on a virtual FS then reads the result |
| Source files touched | about 23: translate 8, tools 10, framework 5 | about 12: translate 3, tools 8, 1 new module | about 14: translate 4, removal of B (491 lines), framework 5, tools 4 |
| Lines removed (estimate) | 600 to 900 | 150 to 250 | 700 to 900 |
| Risk | biggest undertaking | the duality persists, I10 only contains it | no longer excluded by the input format (B treats its input as canon); not retained |
| 6th tool afterwards | profile + registration | profile + registration, two outputs to keep coherent | profile + registration |

Estimates come from file sizes, not from a prototype.

Why form 1: it removes the duality (both outputs are tested against the same engine) and makes the golden runnable in memory. Accepted cost: about 23 files touched. Why not form 2: the duality persists, so every rule stays coded twice and I10 is only a guard. Why not form 3 (proposal, not evidenced beyond the table): it keeps the disk-shaped build as the engine and adds a virtual file system layer in front of it, where form 1 makes the engine pure and the disk a sink.

### Form 1 in detail

Engine signature (decided): `translate(distribution, profile) -> OutputFile[]`.

- Pure: reads no disk and no clock; the distribution is already in memory and the profile is data plus named behaviours from `tools`. Output order is sorted (I4).
- `OutputFile`: today B returns `InstallationFile[]`. The exact shape of `OutputFile` (at least path and content; whether installation's ownership and hash fields belong to it or to the list sink) is to fix. Proposal, not evidenced.
- Two sinks, same engine output:
  - Disk sink: writes the list under an output root through the `FileWriter` port and owns what only A does today: output guard (`force`, non-empty folder), manifest, catalogue, schema check. Used by `aidd translate`, `aidd sync`, build for distributions and ensure-built. The canon read from disk (today `translate-source.ts`) produces the `PluginDistribution` that feeds the engine.
  - List sink: no code of its own: the list is the result, handed to `installation`, which keeps writing, ownership and drift. Used by install, add, update and restore.
- What moves where (proposal, sized from the table above):
  - From the profiles' `build.ts` (7, about 1200 lines) and the `artifact-rules` duplicated steps: paths, token, hooks shape, bridge, rename and collision detection become one implementation in the engine, parameterised by profile data.
  - `PluginContentTranslator` (491 lines) becomes `domain/engine.ts`; the 5 strategies under `application/strategies/` become the disk sink; the 5 `framework` callers of B call the engine through `translate`'s `application/`.
  - Manifest, catalogue, schema and output guard stay on the disk sink side, so the asymmetry in the table above remains intended.
- I10 becomes trivially true: both paths call the same function on the same inputs, so there is nothing left to diverge but the sink. I10 reduces to a conformance check that the disk sink writes exactly the engine's list (plus the declared A-only files) and the list sink adds nothing.
- The golden (`tests/golden/snapshots/framework-build/golden.json`) can run in memory against the engine, with the disk sink covered by a few tests (guard, `force`, collisions on disk).

### Services, commands, ports, dependencies

| Heading | Content |
| --- | --- |
| Domain services | reading and validating the source catalogue (`translate-source.ts:57-100`); translating one component (scattered between A and B today, one engine under form 1); collision detection (duplicated today); `@{{TOOLS}}/` guard (`shared-plugin-helpers.ts`) |
| Commands owned | build a native tree from the canon (today `FrameworkBuildUseCase`); translate a distribution into installation files (today `translateWithComponentPaths`); both renamed to the command convention (one file, one class of the same name, public `execute(command)`, no `UseCase` suffix) |
| Ports owned | `FrameworkBuild`, consumed by `framework` (ensure-built) and `presentation` (`translate` command); target: consumers reach it through `translate`'s `application/` |
| Ports consumed | `ToolCatalog`, `FileReader`, `FileWriter`, `Hasher`, `Logger`, `JsonSchemaValidator` |
| Adapters | Ajv (`infrastructure/schema-validator.ts`); the canon is a file input, not a third party's external system; hosts are not contacted |
| Dependencies | `tools` (11 files import it, 20 imports) and `shared`; 25 files of `framework` import `translate` |

### Tests

| Level | Content |
| --- | --- |
| Unit | pure engine: one input, one output, per component |
| Conformance | I4, I5, I6, I10 |
| Golden | `tests/golden/snapshots/framework-build/golden.json` (295 KB) remains the proof of A for the 7 hosts; `help/surface.json` is not part of this context |
| E2E | `framework-build.e2e.test.ts` |

Overlap: the 4 `marketplace-build-strategy.*` tests (1519 lines) and the 2 `flat-build-strategy.*` tests (1128 lines) assert many paths already pinned by the golden. Only what they alone cover remains: collisions, refusal of a non-empty folder, `force`, placeholder, invalid JSON in a merge.

### Enforceable rules

| Rule | Mechanism | Replaces |
| --- | --- | --- |
| No `.claude-plugin`, `.cursor-plugin`, `.codex-plugin` string outside the canon module | string pattern + dependency-cruiser | nothing automatic |
| `translate` imports only `tools` (through its `application/` and `contract/`) and `shared`; never `orchestration` | import rule | checks in `check-architecture-rules.js` |
| Every output JSON validated against the schema if one exists | conformance I7 | validations scattered in the strategies |

### Current to target mapping (under `cli/src/contexts/translate/`)

| Current path | Action | Target |
| --- | --- | --- |
| `domain/content-translator.ts` | split | form 1: `domain/engine.ts` |
| `domain/build-target.ts` | split | `domain/targets.ts`; Claude constants to `domain/canon-format.ts` |
| `domain/canon.ts` | move | `installation` (or the orchestration that reads it; to confirm) |
| `domain/plugin-distribution.ts`, `plugin-format.ts`, `plugin-translation-skip.ts` | move | `shared/domain` if 2 contexts import them (computation to do), otherwise stays |
| `domain/formats/cursor-hooks.ts` | move | `tools/domain/formats/` |
| `domain/formats/plugin-root-token-rewrite.ts` | merge | `tools/domain/formats/plugin-root-token.ts` |
| `application/translate-source.ts` | rename | `application/build-native-tree.ts`, class `BuildNativeTree` (proposal: name per the command convention) |
| `application/strategies/*` (5) | merge | `application/sinks/disk-sink.ts`; `plugin-source-tree-reader.ts` renamed `sinks/canon-tree-reader.ts` (proposal) |
| none | add | `application/translate-distribution.ts` (command exposing the engine to installation) and `contract/output-file.ts` (proposal: exact fields to fix) |
| `application/shared-plugin-helpers.ts` | keep | same |
| `infrastructure/schema-validator.ts` | move | `shared/infrastructure` (2 contexts use it) |

## 3. Misplaced elements today

| Element | Target | Why |
| --- | --- | --- |
| Per-host session log readers of telemetry (5 files of the baseline: `usage-record.ts`, `claude-projects-root.ts`, `codex-transcript-usage.ts`, `codex-transcript-source-adapter.ts`, `claude-settings-adapter.ts`) | stay in `telemetry`, behind a `SessionLogSource` port | a session log is an external system with a single owner; only Claude and Codex have a reader, so the "6th tool" test must not count them: exemption by folder, no more list |
| Claude constants `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (`build-target.ts:67,70`) | `translate/domain/canon-format.ts` | input language of the canon: the Claude name is legitimate there as long as the canon is that format |
| List of other hosts' manifests (`content-translator.ts:25-30`) | derived from the profiles' `distributionProbes.manifest` | Claude, Cursor and Codex already declare these paths (`claude/profile.ts:37`, `cursor/profile.ts:42`, `codex/profile.ts:131`); line-by-line equivalence not verified |
| Cursor hooks converter (`translate/domain/formats/cursor-hooks.ts`, 39 lines, used by B only) | `tools/domain/formats` | knowledge of one host; its identifier `"flat"` names a shape, to rename after the result |

## 4. Hooks bridges of OpenCode (302 lines) and Kilo (237)

Common structure, read in both files: same regular expression `node ${CLAUDE_PLUGIN_ROOT}/hooks/<script> [args]`, extraction of groups with `matcher`, replay of recognised commands only, generated JavaScript module containing `runHook`, `answerFrom`, `answerOf`, `stopReasonOf`, `toIdentifier`, a case-insensitive matcher filter and script resolution through `import.meta.url`. Line-by-line comparison (host names normalised): about 330 lines of difference out of 539, order of magnitude.

| Aspect | Common | Specific to the host |
| --- | --- | --- |
| Parsing `hooks.json` | yes | no |
| Event table (SessionStart, Stop, PostToolUse) | shape | OpenCode: `session.idle`, V1/server and V2/setup entries; Kilo: `session.created` and `session.idle` |
| Execution and exit code 2 to message to the model | yes | no |
| Export descriptor | no | OpenCode: named export + default; Kilo: mandatory `{ id, server }` |
| Failure report | no | Kilo adds `reportHookFailure` |
| Output path | no | `makeKiloHooksBridgePath` and its OpenCode equivalent |

Target: one `event-bridge` module (parsing + execution model) parameterised by the event table and the descriptor template, plus two parameter files. The test is written as conformance: generate the module for a reference `hooks.json`, load it in Node with a fake host that emits the events, check the calls, instead of comparing text (3 current test files: 401, 405 and 142 lines).

## 5. Single registration

Today four places: `kernel/tool.ts`, `asset-loader.ts`, three side-effect imports. The triple import is an artefact: a module that registers itself on import depends on load order, hence one copy per wiring.

Target (decided): `composition/tool-profiles/` holds one file per tool plus one registration list, a typed array of imported profiles, one line per tool. The catalogue is built once and injected: no global `Map`, no side effect. The id union comes from the array (`as const`); config assets attach to the profile (`configAssets`), the `asset-loader` table disappears. A 6th tool becomes: one profile file, one line in the registration list, plus its assets if it has any.

The earlier reservation (a native-registration section in another file would raise the cost to one file per concerned context) is closed by the decision: the profile is one file holding sections whose types are defined by their reading context, assembled in `composition`.

## 6. Anti-corruption boundary towards each host

Hosts change format without notice, the main source of shipped bugs. Protection sits on the host's real input and output, not on our structures.

| Host | Vendored schema | Accepted output proof |
| --- | --- | --- |
| Claude | yes (plugin manifest, marketplace) | `claude plugin validate` in CI (`.github/workflows/cli-ci.yml:420`) |
| Codex | yes (manifest, marketplace) | local smoke; no CI validation found |
| Copilot | yes (marketplace) | same |
| Cursor, OpenCode, Kilo, VS Code | no | nothing comparable found |
| Antigravity | no | `scripts/smoke-antigravity.sh` (local, login required) |

| Level | What | CI without the host binary |
| --- | --- | --- |
| C1 | vendored schema against the output (Claude, Codex, Copilot); vendor the missing ones | yes |
| C2 | recorded accepted tree: per host and per version, the minimal tree the host loaded, version as metadata; CI compares the shape of our build | yes |
| C3 | real outputs of the host CLI and registries, replayed in the `host-registration` readers | yes |
| C4 | fake host CLI reproducing observed exit codes and messages | yes |
| C5 | real smoke (`smoke-real.sh`, `smoke-antigravity.sh`): write, have the host load, read back its state | no (binary, login, real HOME) |
| C6 | drift probe: re-record C2 and C3 from the host's latest version and compare | no |

No automatic guard calls a model: C5 and C6 are deterministic scripts. I found no recorded host fixture outside `tests/fixtures/claude-usage/` (telemetry logs), without having read every test of `tests/contexts/tools/infrastructure`.

## 7. Tests of the two contexts

All tests are written in English: `describe` names a situation, `it` an observable result.

| Family | Files | Lines |
| --- | --- | --- |
| `tests/contexts/tools/**` | 96 | 11.8 k |
| of which per-tool parallel files (`agents`, `commands`, `content`, `mcp`, `plugins`, `profile`, `rules`, `skills`, `hooks`, `settings`) | 45 | 2155 (263 `it`) |
| of which `build.unit.test.ts` per tool | 7 | 1795 |
| of which hooks bridges | 3 | 948 |
| `tests/contexts/translate/**` | 17 | 4884 |

| Action | Files | Lines | Protection |
| --- | --- | --- | --- |
| Merge the parallel files of 60 lines or fewer (34 of 45) into the conformance suite and its kit | -34 | -1033 | conformance + data snapshot; size threshold, each case read before the file is dropped |
| Keep the 11 longest as per-tool files (Copilot rules and content, OpenCode MCP, Codex hooks and skills, etc.) | 0 | 0 | tool-specific behaviour |
| Add `profile-conformance.unit.test.ts`, its kit, and the data snapshot | +3 | +550 | I1 to I10 on 8 profiles |
| Absorb `registry-conformance.unit.test.ts` | -1 | -320 | into conformance |
| Reduce the `build.unit.test.ts` to the transformation branches | 0 | -500 to -600 | golden + C2 |
| Replace the 3 bridge tests by Node execution of the generated module | -1 | about -400 | executed behaviour rather than text |
| Translate: reduce the 6 strategy integration files to what the golden does not cover | -3 | -1200 to -1500 | collisions, non-empty output, `force`, placeholder |

Estimated total: about -36 files and -3 000 to -3 800 lines out of about 16 700 (tools 11.8 k + translate 4.9 k), i.e. 18 to 23 %, with coverage added where it is missing (I5, I10, extended C1, C2). Planning bounds, not a count.

Mutation: today 9 scopes (`tools` 94, `translate` 85, and 7 per profile: claude 94, codex 94, copilot 95, cursor 97, opencode 94, antigravity 82, kilo 64). Decided target: the per-profile scopes disappear, because a profile is data checked by the conformance suite, not logic with mutants of its own. The per-PR mutation gate remains only for `telemetry` and `shared`; every other scope, including `tools` and `translate`, runs in the weekly cron. Current floors are frozen during the transition (never raised, never lowered without a written reason). The low floors of Antigravity (82) and Kilo (64) are not to be masked while the per-profile scopes still exist. The reason the split existed (a profile is a static declaration whose every mutant reruns all the tests that load it) is why the cost of the conformance suite loading the 8 profiles stays to be measured on the weekly run (unverified).

### Test mapping (under `cli/tests/`)

Every target test file keeps its level suffix (`.unit.test.ts`, `.integration.test.ts`, `.golden.test.ts`).

| Current path | Action | Target |
| --- | --- | --- |
| `contexts/tools/domain/profiles/*/{agents,commands,content,mcp,plugins,profile,rules,skills,hooks,settings}.unit.test.ts` (45) | split | 34 merged into `composition/tool-profiles/profile-conformance.unit.test.ts` and its kit `contexts/tools/testing/profile-conformance.ts`; 11 moved to `composition/tool-profiles/<tool>/` (proposal: location) |
| `contexts/tools/domain/profiles/*/build.unit.test.ts` (7) | move, reduced | `composition/tool-profiles/<tool>/build.unit.test.ts` (proposal) |
| `contexts/tools/domain/profiles/{opencode,kilo}/*bridge*.test.ts` (3) | merge | `contexts/tools/domain/bridges/event-bridge.unit.test.ts`, `event-bridge.integration.test.ts` |
| `contexts/tools/domain/profiles/{antigravity,codex}/*` (hooks, toml, config, hook-response) | move | `contexts/tools/domain/{antigravity,codex}/` (proposal: folder to confirm) |
| `contexts/tools/domain/profiles/agent-fixture.ts` | move | `contexts/tools/testing/agent-fixture.ts` (conformance fixture) |
| `contexts/tools/domain/registry-conformance.unit.test.ts`; `registry.unit.test.ts`, `tool-config.unit.test.ts` | merge | `profile-conformance`; `contexts/tools/domain/catalog.unit.test.ts` |
| none | add | `composition/tool-profiles/profile-data.golden.test.ts` (data snapshot, proposal) |
| `contexts/tools/domain/capabilities/*` (8) | rename | `contexts/tools/domain/sections/*-section.unit.test.ts`; native activation cases of `plugins-capability` to `contexts/host-registration/domain/native-activation.unit.test.ts` |
| `contexts/tools/domain/formats/*` (8) | keep | same |
| `contexts/tools/domain/marketplace-catalog.unit.test.ts` | keep | same (decision 4) |
| `contexts/tools/domain/mcp-launch-command.unit.test.ts` | move | `contexts/tools/domain/formats/mcp-launch-command.unit.test.ts`, mirroring its source |
| `contexts/tools/domain/{marketplace-source-conflict,host-plugin-registration,plugin-enablement-is-machine-global}.unit.test.ts`, `contexts/tools/infrastructure/*` (8) | move | `contexts/host-registration/domain/`, `contexts/host-registration/infrastructure/` |
| `contexts/translate/**` (17) | split | engine, two sinks, golden; see plan |

## 8. Decisions and open questions

Decided (from the overview):

1. A profile is a single file per tool, in `composition/tool-profiles/`, including the native registration section; the "one file, one line" criterion holds. Section types stay defined by the context that reads them; assembly in `composition`.
2. Translation shape: form 1 (section 2).
3. Path B and the input format: the translator branches on no source format and `format` is read in one place only (the project-hooks materialiser), so B treats its input as canon. This no longer decides the shape (form 1 is decided); what remains unestablished is whether a non-canonical distribution can in practice reach B.
4. The marketplace catalogue and its entry stay in `tools`: a build-contract helper shared by the claude and cursor profiles (document 02). Marketplace settings and the `native-marketplace-source` parsers go to `host-registration`, the arguments stay in the profile; `mcp-launch-command` goes to `tools/domain/formats/`.

Still open:

5. Does the canon remain the Claude format? A neutral canon requires migrating the repository's plugins, outside the CLI's scope.

Assumptions about neighbours:

| Neighbour | Assumption |
| --- | --- |
| `installation` | owns materialisation and calls `translate` through its `application/`; the 5 `framework` files that instantiate `PluginContentTranslator` are its |
| `host-registration` | receives 6 infrastructure files, 4 ports, `NativeActivation`, the registry readers; depends on `tools` only through its published contract |
| `orchestration` (what remains of `framework`) | scenarios only; coordinates `translate` and `installation` |
| `shared` (formerly `kernel`) | takes in `JsonSchemaValidator`, `FileMerger`, `PluginDistribution` if the import computation confirms 2 contexts |

Not verified:

- 34 profile files counted, not 35 (71 domain files minus 37);
- equivalence of the hooks shape converters (Cursor, Copilot, project merge);
- existence of the skill `name` rename on the B side;
- which tests of `tests/contexts/tools/infrastructure` are real host recordings;
- that `check-architecture-rules.js` already forbids `tools` to `translate`;
- all line estimates (bounds from file sizes);
- the shape of `OutputFile` and which side holds ownership and hash fields (form 1 in detail).
