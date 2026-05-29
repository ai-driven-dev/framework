# 03 - Extract Methods

Replace stubs with real private methods that each describe a single business intent.

## Inputs

- `execute-body` (required) - string, the drafted execute() with stubs from 02

## Outputs

```typescript
private async buildOutputFiles(options: ApplyWidgetOptions): Promise<WidgetFile[]> {
  const config = await this.repo.loadConfig(options.widgetId);
  if (!config.outputPaths) return [];
  const files: WidgetFile[] = [];
  for (const [name, outputPath] of Object.entries(config.outputPaths)) {
    const content = config.templates[name] ?? "";
    if (await this.isUserOwned(outputPath, options)) continue;
    files.push(new WidgetFile({ relativePath: outputPath, content }));
  }
  return files;
}
```

## Depends on

- `02-write-execute`

## Process

1. For each operation in `execute()` that is not a simple guard or return, extract a private method.
2. Name each method after its domain intent — not after mechanics: `buildConfigFiles` not `loopAndHashFiles`, `applyAndTrack` not `writeAllThenSave` — see `.claude/rules/06-design-patterns/6-method-size.md`.
3. Each extracted method must be ≤20 lines.
4. If a method still exceeds 20 lines, extract a further sub-method. Repeat until all are within limit.
5. Check that no hardcoded technical strings appear in use-case files — those belong in adapters per `references/use-case-rules.md`.

## Test

Run `pnpm typecheck` — exits 0 and `pnpm lint` exits 0 (no `any` types, no unused params introduced by extraction).
