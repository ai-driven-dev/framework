# 04 - Errors, missing files, partial failure

Type every failure, word it at the presenter, and keep the swallow in an adapter.

## Input

The failure to raise, catch or report.

## Output

A typed error with a code and data, its message in the presenter, and a test on the code.

## Process

1. **Load.** Read [architecture.md](../references/architecture.md) and the `references/contexts/<ctx>.md`.
2. **Type it.** A failure is a class in the `<owner>.error.ts` of its context, of `orchestration/`, of `presentation/`, or of `shared/domain/` when two contexts need it. It carries a code and its data, never text. Gates: the `thrown` and `errorText` rules of `kinds.rules.arch.test.ts`.
3. **Word it.** The words live in `src/presentation/errors/error-messages.presenter.ts`. Say what to do, not only what broke; a message that names a command names a real one (`instructs` rule).
4. **Let it travel.** A use case in a context's `application/` never catches: `application-catches.arch.test.ts` fails on any catch.
5. **Report and continue.** A flow that must report one failure and continue catches in an orchestration scenario, on a line tagged `// @policy report-and-continue`, and collects `{ scope, error }` items so one scope never aborts the run.
   - No gate reads the tag: it is a convention (model: `src/orchestration/marketplace/refresh-marketplaces.use-case.ts`).
6. **Best effort.** A caller that treats an unreadable or missing file as absent calls `FileReader.readFileIfReadable` or `realpathIfResolvable` (`src/shared/ports/file-reader.ts`). The swallow sits in `shared/infrastructure/file-adapter.ts`, never in the use case.
7. **Adapters.** An adapter catches only to type a raw error. An empty catch needs `biome-ignore lint/plugin: <reason>` above its `try` (`biome-plugins/no-swallowed-catch.grit`); prefer fixing the cause.
8. **Exit.** A thrown error becomes an exit code per `architecture.md`, Process.
9. **Test.** Assert the failure by its code and data, never its sentence; wording is tested at the presenter.

## Test

| Case | Pass |
| --- | --- |
| a use case throws the new error | the test reads its code and data |
| the presenter receives it | the message names a real command and a next step |
| `pnpm test:arch` | green |
