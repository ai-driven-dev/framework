# 01 - Define Types

Declare the `*Options` input interface and `*Result` output interface for the new use-case.

## Inputs

- `use-case-name` (required) - string, PascalCase name without the `UseCase` suffix (e.g. `InstallRuntimeConfig`)
- `fields` (required) - list of input fields with types and output fields with types

## Outputs

```typescript
export interface ApplyWidgetOptions {
  widgetId: string;
  projectRoot: string;
  force: boolean;
  interactive: boolean;
}

export interface ApplyWidgetResult {
  widgetId: string;
  fileCount: number;
  files: WidgetFile[];
  skipped: boolean;
}
```

## Process

1. Create `src/application/use-cases/<kebab-name>-use-case.ts` (top-level) or `src/application/use-cases/<subdir>/<kebab-name>-use-case.ts` (sub-use-case). Confirm the file does not already exist.
2. Declare `export interface <Name>Options { ... }` with all required input fields. Use `import type` for domain types.
3. Declare `export interface <Name>Result { ... }` with all output fields. Never `Promise<void>` — always return a typed result.
4. Import domain types from `src/domain/models/` using relative paths with `.js` extension.
5. Do not add the class yet — types only in this action.

## Test

Run `pnpm typecheck` — exits 0 confirms interfaces compile and import paths resolve correctly.
