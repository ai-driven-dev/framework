# Reference: thin-wrapper contract

Source of truth for the command action handler. A command wires, it does not orchestrate.

## Rules

- One use-case per command handler
- Commands wire, not orchestrate
- Parse and validate CLI flags before `try/catch`
- Abort with `output.error()` + `process.exit(1)` — never `throw` for flag validation
- Create deps via `createDeps()`
- Call one use-case with `interactive: process.stdout.isTTY`
- Display the typed result with `CLIOutput`
- Catch all errors: `errorHandler.handle(error)` — at the action level only

## Forbidden

- Prompter for domain decisions → move to the use-case
- Repository or manifest access → move to the use-case
- Multiple use-case calls or orchestration → extract one orchestrator use-case
- Business decisions or domain logic in the handler

## Interactive mode

- Use `Prompter` only to resolve missing CLI inputs **before** calling the use-case
- The use-case receives fully-resolved values
- Prompter inside use-cases is for domain interaction only (conflict resolution, strategy choice)
- Non-interactive guards stay in the command (`if (!process.stdout.isTTY && missing) { output.error; exit(1) }`)

## Template

```typescript
export function registerFooCommand(program: Command): void {
  program
    .command("foo")
    // ...flags
    .action(async (cmdOptions) => {
      const { verbose, output, projectRoot } = parseGlobalOptions(program);
      const errorHandler = new ErrorHandler(output);

      // CLI flag guards (abort, not throw)
      if (badFlags) { output.error("..."); process.exit(1); }

      try {
        const deps = await createDeps(projectRoot, { verbose }, output);
        const result = await new FooUseCase(...deps).execute({
          ...,
          interactive: process.stdout.isTTY,
        });
        output.success(`...${result.x}...`);
      } catch (error) {
        errorHandler.handle(error);
      }
    });
}
```
