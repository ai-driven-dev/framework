# 02 - Write Execute

Write the `execute()` method body using early-return guard clauses. Keep it to ≤20 lines by delegating to named helpers.

## Inputs

- `use-case-name` (required) - string, PascalCase name with `UseCase` suffix
- `options-type` (required) - string, the `*Options` interface name from 01
- `result-type` (required) - string, the `*Result` interface name from 01

## Outputs

```typescript
export class ApplyWidgetUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly repo: WidgetRepository,
    private readonly logger: Logger,
  ) {}

  async execute(options: ApplyWidgetOptions): Promise<ApplyWidgetResult> {
    const { widgetId, force } = options;
    const existing = await this.repo.find(widgetId);
    if (existing && !force) {
      return { widgetId, fileCount: 0, files: [], skipped: true };
    }
    const files = await this.buildOutputFiles(options);
    await this.writeAndTrack(files, options);
    return { widgetId, fileCount: files.length, files, skipped: false };
  }
}
```

## Depends on

- `01-define-types`

## Process

1. Add the class declaration with `UseCase` suffix and constructor with injected ports (no `public` on constructor params — always `private readonly`).
2. Add constructor injection in canonical order per `references/use-case-rules.md`: FileSystem → Repository → Loader → Hasher → Logger → Platform → Prompter.
3. Write `async execute(options: *Options): Promise<*Result>` with guard clauses first (early returns for `skipped` or no-op cases).
4. Delegate remaining work to named private methods (stubs for now — filled in 03).
5. Verify the method body is ≤20 lines (counting code lines, not blanks or comments).

## Test

Run `pnpm typecheck` — exits 0 confirms the class signature, constructor types, and execute return type are consistent.
