# Reference: Port Design

## Interface contract

- Interface only — no classes, no implementations
- Single responsibility — ≤5 methods per port
- All I/O methods are `async` and return `Promise<T>`
- No `null` in return types — adapters resolve null internally
- No `I` prefix — file location signals the role

## Intent over mechanism

- Method names describe what the caller wants, not how it's done
- Use domain vocabulary: `install`, `register`, `sync`, `fetch` — not `resolve`, `parse`, `build`, `compute`

## Hide adapter internals

- Implementation details (hook names, runtime strings, system paths) stay in the adapter
- Port signature must not leak the adapter's internal structure

## Exception to ≤5 methods rule

`FileWriter` (6 methods) — documented pragmatic exception for the project's file-system port. All other ports must respect ≤5.

## Genuine-absence ports (null allowed)

A port may return `T | null` only when "not found" is a normal, expected domain state (not an error). These are documented exceptions to the no-null rule:

- `ManifestRepository.load()` — `null` means no manifest exists yet (uninitialized project)
- `PluginCatalogRepository.load()` — `null` means framework has no plugin catalog
- `LatestReleaseResolver.resolveLatest()` — `null` means no release found (pre-release/empty repo)
- `TokenProvider.resolve()` — `null` means no token available (unauthenticated state)

For all other ports, adapters must convert "not found" to a typed state or empty collection.

## Canonical location

`src/domain/ports/<kebab-name>.ts` — e.g. `plugin-fetcher.ts` for `PluginFetcher`
