# 02 - Write Handler

Fill the `.action()` body with the canonical thin-wrapper wiring sequence.

## Inputs

- `command-surface` (required) - string, the command file from 01
- `use-case-name` (required) - string, the PascalCase `*UseCase` class to call

## Outputs

```typescript
.action(async (cmdOptions: { id: string; force?: boolean }) => {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const errorHandler = new ErrorHandler(output);

  // Flag guards — before try block
  if (!cmdOptions.id) {
    output.error("--id is required.");
    process.exit(1);
  }

  try {
    const deps = await createDeps(projectRoot, { verbose }, output);
    const result = await deps.applyWidgetUseCase.execute({
      widgetId: cmdOptions.id,
      force: cmdOptions.force ?? false,
      interactive: process.stdout.isTTY,
    });
    output.success(`Applied widget ${result.widgetId} (${result.fileCount} files)`);
  } catch (error) {
    errorHandler.handle(error);
  }
})
```

## Depends on

- `01-declare-surface`

## Process

1. First line inside `.action()`: `const { verbose, output, projectRoot } = parseGlobalOptions(program)`.
2. Second line: `const errorHandler = new ErrorHandler(output)`.
3. Write all flag guards BEFORE the `try` block. Each guard: `output.error("...")` then `process.exit(1)`. No `throw` — see `references/thin-wrapper.md`.
4. Resolve / parse inputs: paths via `resolve(projectRoot, ...)`, option strings to typed values. Keep this between guards and `try`.
5. Inside `try`: `const deps = await createDeps(projectRoot, { verbose }, output)`.
6. Call exactly ONE use-case: `await deps.<useCaseProp>.execute({ ..., interactive: process.stdout.isTTY })`.
7. Display the result via `output.success(...)` or `output.print(...)`. No formatting helpers, no counters — see `references/wiring.md`.
8. `catch` block: `errorHandler.handle(error)`. This is the ONLY catch block in the file.

## Test

Run `pnpm typecheck` — exits 0 and `pnpm lint` exits 0 confirms the handler compiles without type errors or lint violations.
