# Add or change a command

Load `references/architecture.md` and the `references/contexts/<ctx>.md` of each context the command reaches.

1. Write `register<Name>Command(program, createDeps)` in `src/presentation/controllers/<name>.controller.ts`, typed `DepsSliceFactory<Keys>` over the members of `Deps` it reads (`src/orchestration/deps.ts`), and add it to `register-commands.controller.ts`. Model: `update.controller.ts`.
2. The controller parses options, calls one scenario or one use case through `createDeps`, and prints with a presenter from `src/presentation/presenters/`. It decides nothing.
3. Logic coordinating several contexts is a scenario in `src/orchestration/<area>/`: no business rule, no file read, no process.
4. Logic of one concept is a use case in the context that owns it: `actions/03-domain.md`. One file, one class named by a verb, a public `execute` taking an `XRequest` and returning an `XResult` declared in the same file. Model: `src/contexts/auth/application/log-in.use-case.ts`.
5. Add the new member to `Deps` and wire it in `src/composition/<ctx>.ts`, or `src/composition/orchestration/` for a scenario. `src/cli.ts` builds the factory.
6. Channels and exit codes: `references/architecture.md`, Process. A refusal before the use case runs (missing flag, no TTY) exits in the controller.
7. Errors: `actions/04-failure.md`.
8. A new or renamed subcommand changes `tests/golden/snapshots/help/surface.json`: `pnpm golden:update help-surface`, read the diff, say so in the commit.
9. Tests: one test file per command under `tests/presentation/controllers/`, one e2e per command under `tests/e2e/`. Levels: `actions/05-test.md`.
