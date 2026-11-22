# Errors, missing files, partial failure

Load `references/architecture.md` and `references/contexts/<ctx>.md`.

1. A failure is a class in the `<owner>.error.ts` of its context, of `orchestration/`, of `presentation/`, or of `shared/domain/` when two contexts need it. It carries a code and its data, never text. Gates: the `thrown` and `errorText` rules of `kinds.rules.arch.test.ts`.
2. The words live in `src/presentation/errors/error-messages.presenter.ts`. A message that names a command names a real one (`instructs` rule). Say what to do, not only what broke.
3. A use case in a context's `application/` never catches: it lets its typed error travel. `application-catches.arch.test.ts` counts catches against `tests/architecture/kinds-debt.json`; the count only goes down.
4. A flow that must report one failure and continue catches in an orchestration scenario, on a line tagged `// @policy report-and-continue`, and collects `{ scope, error }` items so one scope never aborts the run. No gate reads the tag: it is a convention (model: `src/orchestration/marketplace/refresh-marketplaces.use-case.ts`).
5. A best-effort caller that treats an unreadable or missing file as absent calls `FileReader.readFileIfReadable` or `realpathIfResolvable` (`src/shared/ports/file-reader.ts`). The swallow sits in `shared/infrastructure/file-adapter.ts`, never in the use case.
6. An adapter catches only to type a raw error. An empty catch needs `biome-ignore lint/plugin: <reason>` above its `try` (`biome-plugins/no-swallowed-catch.grit`); prefer fixing the cause.
7. A thrown error becomes an exit code through `failCommand`; a result that reports a failure sets exit `1` itself (`references/architecture.md`, Process).
8. Test the failure with its code and data, never its sentence. Message wording is tested at the presenter.
