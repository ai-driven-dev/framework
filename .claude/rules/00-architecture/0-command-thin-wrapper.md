---
paths:
  - "src/application/commands/**/*.ts"
---

# Command: Thin Wrapper

## Rules

- One use-case per command handler
- Commands wire, not orchestrate
- Parse and validate CLI flags before `try/catch`
- Abort with `output.error()` + `process.exit(1)`
- Create deps via `createDeps()`
- Call one use-case with `interactive: process.stdout.isTTY`
- Display typed result with `CLIOutput`
- Catch all errors: `errorHandler.handle(error)`

## FORBIDDEN

- Prompter for domain decisions → move to use-case
- Repository or manifest access → move to use-case
- Multiple use-case calls or orchestration
- Business decisions or domain logic

## Interactive mode

- Use `Prompter` to resolve missing CLI inputs before use-case
- Use-cases receive fully-resolved values
- Prompter in use-cases: domain interaction only
- Non-interactive guards stay in the command

## Template

```typescript
export function registerFooCommand(program: Command): void {
  program
    .command("foo")
    // ...flags
    .action(async (cmdOptions) => {
      const globalOptions = program.opts<...>();
      const output = new CLIOutput(globalOptions.verbose ?? false);
      const errorHandler = new ErrorHandler(output);

      // CLI flag guards (abort, not throw)
      if (badFlags) { output.error("..."); process.exit(1); }

      try {
        const deps = await createDeps(projectRoot, globalOptions, output);
        const result = await new FooUseCase(...deps).execute({
          ...,
          interactive: process.stdout.isTTY,
        });
        // display result
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
```
