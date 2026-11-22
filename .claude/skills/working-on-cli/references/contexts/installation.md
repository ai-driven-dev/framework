# installation

What the project records as installed, and how a tool's files are written, restored, updated or reported against it. Language: `src/contexts/installation/glossary.md`.

## Ports

- `ManifestRepository`, `FileMerger`, `Platform`: held here, no contract kit yet.

## Suppliers

- `tools`: `tools/contract/` only; readers name the profile sections they read in `ports/tool-sections.ts`, except the readers that hand the profile to `translate` (Exceptions).
- `translate`, `host-registration`, `distribution`: no edge; each is handed in as a value satisfying this context's own `ports/` (`ports/plugin/plugin-translation.ts`, `ports/marketplace-sources.ts`).
- `shared/`: errors, `Logger`, paths, the source value, file ports.

## Rules

- The manifest root delegates to `domain/manifest/`: a new tracked concept is a module there, never a field of the root. `isFileTracked` reads `files`, `mergeFiles` and each plugin's files; uninstall and clean delete merge files too.
- The manifest reads exactly `MANIFEST_VERSION` and refuses any other, naming the fix.
- An untracked config file that exists is the user's: `TrackedConfigFiles.isUserOwned` skips the write and warns.
- A flow that installs files ends with `RunPostInstallPipeline` (manifest save, then gitignore); one that only changes the manifest saves it directly.

## Never

- Import `orchestration/`, `telemetry/` or `presentation/`.
- Name a tool in `application/`: a profile declares what it consumes.

## Exceptions

- The plugin translation pipeline in `application/` and `presentation/controllers/setup/setup.controller.ts` take the whole profile, each under a `biome-ignore lint/plugin` above its import; closes when each declares its own profile input, as `translate` does in `src/contexts/translate/domain/translate-profile.ts`.
- Restore asks through an injected `ConflictResolver` on the single-tool interactive restore (`run-sync`); closes when sync lists drift through `status` and hands restore a keep list, which changes log order.
- `application/removal/project-plugin-withdrawal.ts` types the `ClaimedRefWithdrawal` that `remove-user-plugin` and `purge-marketplace-plugins` drive: host seams until orchestration calls the `host-registration` and `machine-claims` contracts.
- `AddPlugin` saves the machine manifest before the project one, so a failed project save leaves the machine claim behind (pinned by a unit test); changing it is a behaviour change.
