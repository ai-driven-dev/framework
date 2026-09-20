# The framework source is machine-scope

One registration of `aidd-framework` per machine, shared by every project. Read when touching `setup`, `sync`, `doctor`, `clean` or `references.json`.

## Why

- A project-scope source made claude, codex and copilot disagree on a second project.
- Measured: codex and copilot refuse a second source under the same name; claude silently repoints the whole machine.
- So the source left `<projectRoot>/.aidd/`.

## Where

- Registration: `userConfigDir()/marketplaces.json`, `scope: "user"`.
- Build: `userConfigDir()/cache/built/<version>/aidd-framework/<tool>` (`kernel/paths.ts`, `userBuiltMarketplaceDir`).
- Built once per CLI version.

## Migration

- `MarketplaceRegisterFrameworkUseCase` normalizes a project-scope `aidd-framework` entry to the shared registry on `setup` or `sync`. This is local metadata, not authority to take over the native host.
- `MarketplaceRegistryAdapter.list()` answers project-scope entries first, so a leftover would otherwise shadow the shared entry. Normalization carries the entry's own recorded source, never the local-path default.
- A Claude host still tracking a pre-migration cache is repointed only if the old machine manifest, current host registry source, old catalogue/version, and complete host refs prove the exact AIDD cache with no foreign ref. It then records both projects' claims.
- Unproven legacy host state is left for manual reconciliation. Codex and Copilot do not reclaim a reserved name by force when the current source cannot be proved.
- Native hosts are reconciled only after their current marketplace source and complete plugin references prove AIDD ownership. A reserved-name collision without that proof is left for manual reconciliation; a host without a readable source refuses mutation.
- This project's stale `.aidd/cache/built/aidd-framework/` is deleted only once the run reports no error, no missing binary, no failed build. A host needs that tree to resolve what it unregisters.

## `references.json`

- `userConfigDir()/references.json`: `{ "<version>": ["<projectRoot>", …] }` (`contexts/framework/domain/ports/user-source-references.ts`).
- Written by `setup` and `sync` only after the selected native host registration is proven; a refusal does not create a new claim.
- `clean` drops only this project's claim, once. It proves current source and host references before any project-scoped host removal; a shared registration is left untouched even if its source cannot be read. A machine-global plugin ref without a canonical machine claim is left enabled for manual reconciliation, not treated as exclusively owned by the last project in `references.json`.
- A help, not an authority: a `projectRoot` deleted with `rm -rf` is ignored at read.
- At zero claims, `clean` names `clean --scope user` as the purge.
- `aidd marketplace remove aidd-framework` refuses the same way; it carries no `--scope user` flag.

## `doctor`

- Reads the registered path's version segment structurally, never a catalog.
- Warns, never errors, when a host follows a newer aidd (names `aidd update`).
- Warns when a host still points at a per-project cache (names `aidd sync`).
- Whether the registry itself records project scope or only the host lags.

## `sync`'s write path

- Refuses to write to a host already ahead.
- Brings a host behind forward only after its current source and plugin refs prove AIDD ownership; unsupported Copilot versions refuse native activation.
- Same version: no-op.

## `setup --scope user`

- Registers the shared local source; native machine-wide activation requires verified current host source/ref proof. Unsupported Copilot versions refuse it.
- Writes nothing under `projectRoot`: no content, no plugin prompt, no gitignore touch.
- Its manifest: `userManifestPath(userConfigDir())`, `userConfigDir()/manifest.json`, same schema and version as the project one.
- `UserManifestRepositoryAdapter` reuses `Manifest.fromJSON`/`toJSON`; its `delete()` removes that one file only.
- Each AI tool gets a manifest entry with an empty file list, so `MarketplaceSyncSettingsUseCase` has something to iterate.
- Records no `references.json` claim: absence is the state until `clean --scope user`.
- `doctor --scope user` runs only `DoctorRegistrationUseCase`.
- `sync --scope user` resolves the same manifest.
- `--scope <project|user>` on all three, default `project`.
- Refuses an `--ide` tool (`UserScopeIdeToolsError`): IDE config is project-relative.
- Refuses an AI tool without machine-wide activation (`UserScopeUnsupportedAiToolsError`; `registry.ts`'s `supportsUserScopeActivation`, false for opencode alone).
- Both refusals fire in `SetupFlow`'s constructor; `--ai all` is unusable at this scope.
