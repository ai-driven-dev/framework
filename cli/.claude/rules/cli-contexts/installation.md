---
description: Apply when the installation record, or what installs, restores, updates or reports it, changes; the installation context owns the manifest and the flows that write it into a project.
paths:
  - "src/contexts/installation/**/*.ts"
  - "tests/contexts/installation/**/*.ts"
---

# Installation

## Reason to change

- What the project records as installed, and how a tool's files are written, restored, updated or reported against it. Its language is `src/contexts/installation/glossary.md`; its shape is `reference-context.md`.

## Ports

- `ManifestRepository`, `FileMerger`, `Platform`, `PluginDistributionReader`: held here, implemented by its adapters, no contract kit yet.

## Suppliers

- `tools`: `tools/contract/` only; the `ToolCatalog`, and readers name the profile sections they read in `ports/tool-sections.ts`, except the readers of the `M-T4` row of the reference.
- `translate`, `host-registration`, `distribution`: none; each is handed in as a value satisfying this context's own `ports/` (`plugin/plugin-translation.ts`, `native-host.ts`).
- `shared/`: errors, `Logger`, paths, the source value, file ports.

## Rules

- The manifest root delegates to `domain/manifest/`; a new tracked concept is a module there, never a field of the root. `isFileTracked` reads `files`, `mergeFiles` and each plugin's files; uninstall and clean delete merge files too.
- The manifest reads exactly `MANIFEST_VERSION`, and refuses any other version with the fix named.
- An untracked config file that exists is the user's: `TrackedConfigFiles.isUserOwned` skips the write and warns.
- A flow that installs files ends with `RunPostInstallPipeline` (manifest save, then gitignore); one that only changes the manifest saves it directly.

## Never

- Import `orchestration/`, `telemetry/` or `presentation/`: they ask installation for a flow, never the reverse.
- Name a tool in `application/`: a profile declares what it consumes, held by `tool-addition-cost.arch.test.ts`.
- Change what a command prints or writes: use-case tests, e2e and goldens freeze it.
