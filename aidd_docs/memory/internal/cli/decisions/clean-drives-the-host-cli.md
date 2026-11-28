# `clean` drives the host's own CLI

`clean` never writes a host registry by hand and never deletes what aidd did not write.

## Project scope, in order

1. Through the host's CLI: `uninstallPlugin` per recorded ref, then `removeMarketplace` at its scope.
2. Remove tracked, merge and plugin files.
3. Remove `.aidd/` last: step 1 needs `.aidd/cache/`.
4. Remove untracked machine-local files: Claude's `settings.local.json`, a project-merged `.cursor/hooks.json` and its `.cursor/hooks/<plugin>/` (`cli/src/contexts/installation/application/removal/remove-project-hooks.use-case.ts`).
5. Leave user-scope plugin folders: the user manifest owns them.
6. Purge each driven tool's declared `pluginCacheDir`, under the same containment.

- Only Copilot force-removes; Claude and Codex can refuse a marketplace still holding plugins.
- A binary off `PATH` is named and left alone.
- User-scope deletion refuses a `..` segment or a symlink created after install.
- A dry run lists the same and drops nothing.

## Ownership

- A project clean never removes the shared `aidd-framework` registration; it warns with its entry and cache path.
- A ref with an exact `<plugin>@<catalogue>` claim in the user manifest is machine-owned: project clean never uninstalls it.
- A catalogue a machine ref claims stays registered; one no user manifest proves unshared is left for manual cleanup.
- A host ref no claim names, on a catalogue aidd owns, is the person's own: never adopted or uninstalled, and its catalogue stays registered. User clean and `marketplace remove` refuse rather than take it; on a catalogue aidd does not own, it still refuses the registration.

## Cache purge

| Host declares | Purge | Measured |
| --- | --- | --- |
| Claude: `marketplaceRegistry` and `pluginCacheDir` | full, once a fresh registry read no longer names the host | orphaned tree marked `.orphaned_at`, never deleted |
| Codex: `pluginCacheDir` alone | only once proven empty | `plugin remove` leaves an empty shell |
| Copilot: neither | never | none |

## `clean --global`

- Purges the shared source and AIDD-owned user-scope plugins once every dependent project detached.
- Without a user manifest, which a project-scope `setup` never writes, steps 1 to 3 are skipped and said so.
- A live project in `references.json`, or a plugin's active dependent, blocks removal, even with `--force`.
- Steps 1 and 2 run at scope `"user"`, only for native refs AIDD enabled and claimed.
- An absent binary, failed unregister, unreadable claim or unsafe plugin path aborts and keeps the manifest.
- Then a fixed whitelist, each entry re-resolved through `realpath` and `isStrictlyWithin`: `cache/built/`, both `update-check.json`, the empty `cache/`, `references.json`.
- Without `--force`, confirmation names the source, every built version and every live project.
