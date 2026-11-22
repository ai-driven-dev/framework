# 02 - Add or change a command

Add a command as a thin controller over one scenario or use case.

## Input

The command and the contexts it reaches.

## Output

A registered controller, its wiring, and its controller and e2e tests.

## Process

1. **Load.** Read [architecture.md](../references/architecture.md) and the `references/contexts/<ctx>.md` of each context the command reaches.
2. **Controller.** Write `register<Name>Command(program, createDeps)` in `src/presentation/controllers/<name>.controller.ts`, typed `DepsSliceFactory<Keys>` over the members of `Deps` it reads (`src/orchestration/deps.ts`), and add it to `register-commands.controller.ts`. Model: `update.controller.ts`.
   - It parses options, calls one scenario or one use case through `createDeps`, and prints with a presenter from `src/presentation/presenters/`. It decides nothing.
3. **Scenario.** Logic coordinating several contexts is a scenario in `src/orchestration/<area>/`, with no business rule, file read or process.
4. **Use case.** Logic of one concept is a use case in its owning context ([03-domain.md](03-domain.md)): one file, one class named by a verb, a public `execute` taking an `XRequest` and returning an `XResult` declared in the same file. Model: `src/contexts/auth/application/log-in.use-case.ts`.
5. **Wire.** Add the member to `Deps` and wire it in `src/composition/<ctx>.ts`, or `src/composition/orchestration/` for a scenario. `src/cli.ts` builds the factory.
6. **Output.** Follow `architecture.md`, Process, for channels and exit codes.
7. **Failure.** Follow [04-failure.md](04-failure.md).
8. **Gate.** Run `pnpm lint`: a new command passes the Biome gate and adds no `kinds-debt.json` entry (router rule).
9. **Help surface.** A new or renamed subcommand changes `tests/golden/snapshots/help/surface.json`: run `pnpm golden:update help-surface` and read the diff.
10. **Tests.** Write one test file per command under `tests/presentation/controllers/` and one e2e per command under `tests/e2e/`, at the levels of [05-test.md](05-test.md).

## Test

| Case | Pass |
| --- | --- |
| `pnpm lint` | exits 0 with no new `kinds-debt.json` entry |
| `pnpm test:golden` | the help surface matches the regenerated snapshot |
| `pnpm test:e2e` for the command | exit code, output and files as specified |
