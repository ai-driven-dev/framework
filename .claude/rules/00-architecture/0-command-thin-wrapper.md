# Command: Thin Wrapper

Each command handler calls exactly ONE use-case. Commands wire, not orchestrate.

## What belongs in a command

- Parse and validate CLI flags before `try/catch` (abort: `output.error()` + `process.exit(1)`)
- Create deps via `createDeps()`
- Resolve framework via `resolveFramework()` (input preparation from flags, not business logic)
- Call ONE use-case via `new FooUseCase(...deps).execute({ ..., interactive: process.stdout.isTTY })`
- Display the typed result with `CLIOutput`
- Catch all errors: `errorHandler.handle(error)`

## FORBIDDEN in a command

- Prompter calls for domain decisions (conflict resolution, strategy selection) => move into the use-case
- Repository or manifest access => move into the use-case
- Multiple use-case calls or orchestration between use-cases
- Business decisions or domain logic

## Interactive mode

- Commands has to use `Prompter` to resolve missing CLI inputs (level, credential) before calling the use-case
- Use-cases receive fully-resolved values — no `Prompter` for input collection inside a use-case
- Prompter in use-cases is only for domain-level interaction (e.g. conflict resolution, strategy selection)
- Non-interactive guards stay in the command (fast early exit before deps creation)

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
        const { path: frameworkPath, version } = await resolveFramework(...); // input prep only
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
