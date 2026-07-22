# 01 - Define Port

Write the port interface in `src/domain/ports/` that describes what the application layer needs.

## Inputs

- `port-name` (required) - string, PascalCase name without suffix (e.g. `PluginFetcher`)
- `methods` (required) - list of method names and return types the application needs

## Outputs

```typescript
// src/domain/ports/widget-fetcher.ts
export interface WidgetFetcher {
  fetch(widgetId: string, options?: WidgetFetchOptions): Promise<WidgetData>;
  list(filter: WidgetFilter): Promise<WidgetSummary[]>;
}

export interface WidgetFetchOptions {
  forceRefresh?: boolean;
}
```

## Process

1. Create `src/domain/ports/<kebab-name>.ts`. The file name matches the interface name: `WidgetFetcher` → `widget-fetcher.ts`.
2. Declare only an `interface` — no classes, no default implementations.
3. Apply ≤5 methods per port per `references/port-design.md`. If more are needed, split into two focused interfaces.
4. All I/O methods must be `async` and return `Promise<T>`. Never `T | null` in return types — adapters resolve null internally.
5. Name methods using domain vocabulary (intent over mechanism): `install`, `register`, `fetch` — not `resolve`, `parse`, `build`.
6. Hide implementation details: no OS-level strings, hook names, or runtime identifiers in the port signature.
7. No imports from `application/` or `infrastructure/`.

## Test

Run `pnpm typecheck` — exits 0 confirms the port compiles and has no import-cycle violations.
