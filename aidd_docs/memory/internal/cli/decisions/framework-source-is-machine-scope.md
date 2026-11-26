# The framework source is machine-scope

One `aidd-framework` registration per machine, shared by every project, under the user config dir.

## Why

- A project-scope source made Claude, Codex and Copilot disagree on a second project.
- Codex and Copilot refuse a second source under one name; Claude silently repoints the whole machine.

## Where

Files and paths: [`cli/README.md`](../../../../../cli/README.md#on-the-machine). Code and shape:

- The registration is `scope: "user"`; the user manifest has a project's schema.
- One build per CLI version: `userBuiltMarketplaceDir` in `cli/src/shared/domain/layout/aidd-layout.ts`.
- Project claims are `{ "<version>": ["<projectRoot>"] }`: `cli/src/contexts/machine-claims/ports/user-source-references.ts`.

## Migration

- `RegisterFrameworkMarketplace` moves a project-scope `aidd-framework` entry to the shared registry on `setup` or `sync`.
- `MarketplaceRegistryAdapter.list()` answers project entries first, so a leftover shadows the shared one.
- A native host is reconciled only once its source and plugin refs prove AIDD ownership; otherwise it is left alone, and an unreadable source refuses mutation.
- The project's stale `.aidd/cache/built/aidd-framework/` is deleted only after a clean run.

## `references.json`

- `setup` and `sync` claim only after the native registration is proven.
- `clean` drops only this project's claim; the shared registration stays.
- Advisory: a deleted `projectRoot` is ignored.
- At zero claims, `clean` and `marketplace remove aidd-framework` name `clean --global` as the purge.

## `doctor` and `sync`

- `doctor` reads the version segment of the registered path, never a catalog.
- `doctor` warns when a host follows a newer aidd or a per-project cache.
- `sync` refuses a host already ahead; same version is a no-op.
- `sync` brings a host forward only after the same ownership proof.

## `setup --global`

- Registers the shared source; writes nothing under `projectRoot`.
- Copilot proves its source through `plugin marketplace list --json`, refused where unsupported.
- `--plugins all|recommended|none|<names>` picks from the shared catalog; an interactive pick is refused (`UserScopePluginModeError`).
- A tool with native activation gets plugins through `enablePlugins`.
- A tool with `globalFiles` or a user plugins folder gets `scope: "user"` copies, rebuilt by `sync --global`.
- Each AI tool gets a manifest entry with an empty file list for native sync; no `references.json` claim.
- Refuses an editor in `--ide` (`UserScopeIdeToolsError`): editor config is project-relative.
- Refuses a tool without `supportsUserScopeActivation` (`UserScopeUnsupportedAiToolsError`), so `--ide all` fails here.
- `doctor --global` checks registration only; the default is project scope.
