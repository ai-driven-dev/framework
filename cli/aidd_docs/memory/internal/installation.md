# Installation

The installation record of a project and the flows that write it: init, install, restore, plugin update and status. The context's language is `src/contexts/installation/glossary.md`; its shape is the `reference-context.md` rule.

## Reserved

- I3: installation is not in `HELD_BY_BIOME`. It is held by `PUBLIC_MODULES` in `tests/architecture/context-boundary.arch.test.ts`, whose installation list names 26 interior files that `framework` imports, and the context has no `contract/` folder. Moving it to `HELD_BY_BIOME` needs those files behind installation commands or a `contract/` folder first, so the Biome rule has one public path to allow. Vanishes with the orchestration split, when each framework orchestrator moves out and the list empties.
- I4: contract kits for `ManifestRepository`, `FileMerger`, `Platform` and `PluginDistributionReader`, run on the fake and on the adapter. Vanishes with the next installation PR.
- I5: the restore sub-commands (`RestoreAllPlugins`, `RestoreDriftEntries`, `RestoreMergeFiles`, `RestoreRegularFiles`, `RestoreToolFiles`) are public only because TypeScript has no file-private class across files. `restore.ts` is the only entry callers use. Vanishes when restore is split into its own folder with an index the boundary guard names.
