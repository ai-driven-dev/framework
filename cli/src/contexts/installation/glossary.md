# Installation glossary

The language of the `installation` context. A name in the code means what this page says.

| Term | Meaning | In the code |
| --- | --- | --- |
| Manifest | The record of what is installed in a project: its version and, per tool, its files and plugins | `Manifest`, `ManifestRepository` |
| Tracked file | A file the manifest owns, with the hash it had when written | `TrackedFile` |
| Tool entry | One tool's slice of the manifest: its files, merge files and plugins | `ToolEntry` |
| Merge file | A file the framework shares with the user and merges into instead of overwriting | `MergeFileEntry`, `FileMerger` |
| Install scope | Whether an installation is for one project or for every project of the machine | `Scope` |
| Init | Creating the manifest of a project that has none | `InitProject` |
| Install | Writing a tool's agents, commands, rules, skills and config into a project and recording them | `InstallAgents`, `InstallCommands`, `InstallRules`, `InstallSkills`, `InstallConfig` |
| Post-install pipeline | What runs after files are written: hooks, gitignore, the manifest save | `RunPostInstallPipeline` |
| Restore | Writing again what the manifest says is installed, from the source, after it was deleted or changed | `Restore`, `RestoreToolFiles` |
| Config artifact | A file of the canonical source a profile consumes to build a tool's config, named by a `ConfigRef` | `ConfigRef`, `configRefsOf` |
| Drift | A tracked file whose content no longer matches its recorded hash | `DetectPluginDrift` |
| Materialization | Turning a plugin's canonical content into the files of a tool, in marketplace or flat mode | `PluginTranslator`, `resolvePluginTranslator` |
| Plugin update | Replacing an installed plugin's files with a newer version of its source | `UpdatePlugin`, `ApplyPluginFiles` |
| Status | What the manifest and the files on disk say about a project, side by side | `ReportStatus` |
| Distribution reader | What reads a plugin distribution already built on disk | `PluginDistributionReader` |
