# Decision: ErrorHandler replaces CLIOutput.exit()

| Field   | Value                                       |
| ------- | ------------------------------------------- |
| ID      | DEC-017                                     |
| Date    | 2026-04-08                                  |
| Feature | error-handling                               |
| Status  | Accepted                                    |

## Context

`CLIOutput.exit()` combined error formatting (`instanceof` check) and process control (`process.exit(1)`) in a pure output channel, violating the zero-logic rule. Commands called `output.exit(error)` in catch blocks with no extensibility point for error-type-specific behavior.

## Decision

Introduce `ErrorHandler` in `src/application/error-handler.ts`. Commands instantiate it before the try block (`const errorHandler = new ErrorHandler(output)`) and use `errorHandler.handle(error)` in catch blocks. `CLIOutput.exit()` is removed. ErrorHandler is NOT in Deps — it's a command-layer concern since `deps` is declared inside `try` and unavailable in `catch`.

## Alternatives Considered

| Alternative | Pros | Cons | Rejected because |
| --- | --- | --- | --- |
| ErrorHandler in Deps | Single instance, shared | deps unavailable in catch block | Commands can't access deps in catch |
| Keep output.exit() | No migration needed | Violates zero-logic rule, no extensibility | Architecture violation |

## Consequences

- `CLIOutput` is a pure output channel (zero logic)
- All 13 commands use uniform `errorHandler.handle(error)` pattern
- Flag guards (`output.error() + process.exit(1)`) remain for CLI validation before try
