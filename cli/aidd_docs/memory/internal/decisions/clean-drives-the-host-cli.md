# `clean` drives the host's own CLI

`clean` never writes a host registry by hand and never deletes what aidd did not write. Read when touching `clean`, `clean --scope user` or a cache purge.

## Project scope, in order

1. Undo native registration through the host's CLI: `uninstallPlugin` per recorded ref, then `removeMarketplace` at its scope. Only Copilot declares a force-remove; Claude and Codex can refuse a marketplace still holding plugins.
2. Tracked files, merge files, plugin files.
3. `.aidd/` itself. A host needs `.aidd/cache/` alive during step 1.
4. Machine-local files no `plugins[].files` tracks: `.claude/settings.local.json`, a project-merged `.cursor/hooks.json` and its `.cursor/hooks/<plugin>/`, through `application/shared/remove-project-hooks.ts`.
5. No user-scope plugin directory: the user manifest owns those files. Project clean detaches its canonical root only after local cleanup succeeds. A `..` segment or a post-install symlink is refused by explicit user-scope deletion.
6. Right after step 1, per tool driven: the cache root its profile declares (`NativeActivation.pluginCacheDir`), `<root>/<hostName>`, under the same containment.

- A binary off `PATH` is named and left alone.
- The shared `aidd-framework` registration is the one exception: `undoMarketplaceRegistration` refuses on the scope and warns, naming the host registration, the `marketplaces.json` entry and the tool's cache path.
- A native ref with an exact `<plugin>@<host catalogue>` claim in the user manifest is machine-owned: project clean never uninstalls it, including when this is the last project. It also leaves a project-labelled Codex/Copilot catalogue registered while an exact machine ref still claims that host catalogue; for non-framework catalogues, no user manifest to prove it unshared also leaves the registration for manual host cleanup. The framework source has its separate `references.json` authority and may not have a user manifest. Project clean detaches this project's root after local cleanup. A preexisting host ref without a machine claim is foreign and never adopted.
- Targeted user-scope `plugin update` rematerializes machine-owned files for Cursor. Copilot's native `plugin update <plugin>@<catalogue>` updates an AIDD-owned exact ref through its binary, with dependent projects named and no manual host-cache writes. Codex has no targeted update verb; this command refuses for Codex rather than claiming `upgradeMarketplaces()` updated that one plugin. Use `marketplace refresh` or `framework update` for its catalogue/version workflow.
- The warning names how many other projects still reference the source, or that `clean --scope user` purges it.
- A dry-run reports the same list without dropping anything.
- Machine claims are changed under an inter-process manifest lock covering load, mutation and save. `plugin add` also holds it while fetching/building and writing the project; a slow operation may make another project wait up to 30 seconds, then fail with a named busy-lock error and require a retry. The lock is never stolen solely because it has aged, so contention cannot silently lose B's claim.

## Cache purge

- Claude declares `marketplaceRegistry` too: full purge, gated on a fresh registry read no longer naming the host. Measured: claude marks an orphaned tree `.orphaned_at`, never deletes it.
- Codex declares `pluginCacheDir` alone: purged only once proven empty. Measured: its `plugin remove` leaves the empty shell.
- Copilot declares neither: never touched.

## `clean --scope user`

- The one command that purges the shared source and AIDD-owned user-scope plugin files/native refs, after every dependent project has detached.
- The user manifest is optional: a project-scope `setup` never writes one yet leaves the whitelist behind.
- Without it, steps 1–3 are skipped and said so. A live project in `references.json` still blocks source/cache purge, even with `--force`.
- Steps 1–2 run at scope `"user"` only for native refs AIDD enabled and claimed; a foreign preexisting ref is never uninstalled. Active per-plugin dependents in the user manifest block removal, separately from the `references.json` source claim, even with `--force`. An absent binary, failed host unregister, unreadable source claim or unsafe tracked plugin path aborts without deleting the canonical manifest.
- Step 3: `purgeAllNativeCaches`, shared with project-scope `clean`.
- Step 4, always: a hardcoded whitelist under `userConfigDir()`: `cache/built/` in full, `cache/update-check.json`, root `update-check.json`, the `cache/` shell once a fresh `listDirectory` proves it empty, `references.json`; each re-resolved through `realpath` and `isStrictlyWithinUserScope` before deletion.
- `manifest.json` goes through its repository, the `aidd-framework` entry alone out of `marketplaces.json` through the registry; neither takes a path from the manifest.
- `userConfigDir()` itself is never a candidate.
- Confirmation, unless `--force`, names the source, every version under `cache/built/`, every live project in `references.json`, and the no-registration note.
- A project must clean/detach before this purge; automatic repair of a still-dependent project is not a safety mechanism.
