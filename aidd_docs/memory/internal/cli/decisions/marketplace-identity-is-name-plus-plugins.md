# A marketplace's identity is its declared name plus its plugin set

Read before touching marketplace registration, its source check or `nativeRegistrations.marketplaces`.

## Alias and host name

- A project's local alias may differ from the name its catalog declares; Claude registers by the catalog's name only.
- `nativeRegistrations.marketplaces` records both: `alias` (aidd's key) and `hostName` (the catalog's name).
- Every host-facing call addresses `hostName`: the guard, the source check, removal, uninstall and cache purge.

## Why aidd checks

- `claude plugin marketplace add` takes the name from the source's `marketplace.json`.
- Claude silently repoints a known name: no prompt, no error, exit 0, whatever the `--scope`. aidd refuses instead.

## The check

- Registration reads the host's `known_marketplaces.json` first, through `realpath` (`cli/src/contexts/host-registration/ports/host-marketplace-registry.ts`).
- It refuses only a `hostName` registered under a different catalog (`cli/src/contexts/host-registration/domain/source/marketplace-source-conflict.ts`).
- Identity is the declared name plus the plugin set, from each side's `marketplace.json`; never a path or a version.
- A version bump under the same name and plugins is a repoint to a newer build: no conflict.
- The same catalog from another resolved path is no conflict: two projects building `aidd-framework` do exactly that.
- A registered source whose catalog cannot be read is a dead entry that a re-add repairs.
- `doctor` makes the same read at `error` severity.
- The refusal counts in `SyncFailedError`: `sync`, `plugin install | remove | update` and `marketplace add | remove | refresh` exit non-zero.
