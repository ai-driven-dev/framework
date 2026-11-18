# Translate glossary

The language of the `translate` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Canon | The plugin shape the framework is written in: a Claude-format source tree whose manifest, hooks, mcp and component folders have fixed paths | `domain/canon-format.ts`, `PluginFormat` |
| Distribution | One plugin, read from its source and held as its manifest, its files and its components by kind | `PluginDistribution` (shared), `TranslateDistributionCommand` |
| Engine | The one place a plugin's content is rewritten for a tool, in memory: prose, plugin-root token, frontmatter, hook scripts and the skip list. It writes nothing | `PluginContentEngine`, `domain/engine.ts` |
| Translation | The files the engine produces for one plugin and one tool, each a path and its content. Hashing them is the caller's | `TranslatePluginDistribution`, `OutputFile` (`domain/`) |
| Sink | What writes a translation to disk for `aidd translate`: the marketplace tree, the flat tree, the merged mcp and hooks files and the bridge | `DiskSink`, `application/sink/` |
| Build mode | How a tool takes the built tree: as a marketplace or flat in the project. The tool's build contract declares each | `FrameworkBuildTargetMode`, `ToolBuildContract` (tools) |
| Build target | A tool the build can produce a tree for | `FrameworkBuildTarget`, `supportedBuildTargets` |
| Native tree | The tree a tool's own plugin CLI installs, built from the canon | `BuildNativeTree`, `FrameworkBuild` |
| Flat layout | Where a flat plugin's files land and how its hooks bridge is generated | `domain/flat-layout.ts` (answers come from tools) |
| Divergence | A path where the sink and the engine are known to differ in bytes, listed and meant to shrink | `DIVERGENCES` in `translate-distribution-conformance.integration.test.ts` |
| Plugin-root token | The variable a plugin's files use for their own directory, rewritten to the one a tool expands | `rewritePluginRootToken`, `tools/contract/plugin-root-token.ts` |
| Manifest probe | Where a tool keeps a plugin manifest, built from the registered profiles | `pluginManifestProbes`, `DistributionProbe` (`domain/`) |
