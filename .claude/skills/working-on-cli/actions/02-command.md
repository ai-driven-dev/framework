# 02 - Add or change a command

Add a command as a thin controller over one scenario or use case.

## Input

The command and the contexts it reaches.

## Output

A registered controller, its wiring, and its controller and e2e tests.

## Process

1. **Load.** Read [architecture.md](../references/architecture.md) and the `references/contexts/<ctx>.md` of each context the command reaches.
2. **Controller.** Write `register<Name>Command(program, createDeps)` in `src/presentation/controllers/<name>.controller.ts`, typed `DepsSliceFactory<Keys>` over the members of `Deps` it reads (`src/orchestration/deps.ts`). Model: `update.controller.ts`.
   - A top-level command is registered in `src/presentation/controllers/menu/register-commands.controller.ts`.
   - A subcommand of a group registers in that group's controller and its `MENU` entry, for example `src/presentation/controllers/plugin/plugin.controller.ts`.
   - It parses options, calls one scenario or one use case through `createDeps`, and prints with a presenter from `src/presentation/presenters/`. It decides nothing.
3. **Scenario.** Logic coordinating several contexts is a scenario in `src/orchestration/<area>/`, with no business rule, file read or process.
4. **Use case.** Logic of one concept is a use case in its owning context ([03-domain.md](03-domain.md)): one file, one class named by a verb, a public `execute` taking an `XRequest` and returning an `XResult` declared in the same file. Model: `src/contexts/auth/application/log-in.use-case.ts`.
5. **Wire.** Add the member to `Deps` and wire it in `src/composition/contexts/<ctx>.ts`, or `src/composition/orchestration/` for a scenario. `src/cli.ts` builds the factory.
6. **Online.** A command that touches the network joins `ONLINE_COMMAND_PATHS` in `src/presentation/hooks/update-notice-hooks.ts`; any other command works offline.
7. **Output.** Follow `architecture.md`, Process, for channels and exit codes.
8. **Failure.** Follow [04-failure.md](04-failure.md).
9. **Gate.** Run `pnpm lint`: a new command passes the Biome gate and adds no `kinds-debt.json` entry (router rule).
10. **Help surface.** A new or renamed subcommand changes `tests/golden/snapshots/help/surface.json`: run `pnpm golden:update help-surface` and read the diff.
11. **Tests.** Write a unit test per controller under `tests/presentation/controllers/` (the kind table owes `unit`), and an e2e under `tests/e2e/` only for a journey no lower level proves, at the levels of [05-test.md](05-test.md).

## Test

| Case | Pass |
| --- | --- |
| `pnpm lint` | exits 0 with no new `kinds-debt.json` entry |
| `pnpm test:golden` | the help surface matches the regenerated snapshot |
| `pnpm test:e2e` for a new journey | exit code, output and files as specified |
