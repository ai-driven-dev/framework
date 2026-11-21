import type { Command } from "commander";
import type { Deps } from "../../orchestration/deps.js";
import type { Output } from "../../orchestration/domain/output.js";
import {
  printForgetResult,
  printIdentityRule,
  printOffResult,
  printOnResult,
} from "../display/telemetry/telemetry-lifecycle-display.js";
import { printIdentityResult } from "../display/telemetry-display.js";
import {
  commandOf,
  type TelemetryCommandKeys,
  type TelemetrySurface,
} from "./telemetry-surface.js";

interface OnOptions {
  readonly yes: boolean;
  readonly as?: string;
  readonly anonymous: boolean;
}

/** Where `on` runs and prints. */
interface Where {
  readonly output: Output;
  readonly projectRoot: string;
}

async function turnOn(
  deps: Pick<Deps, TelemetryCommandKeys>,
  { output, projectRoot }: Where,
  options: OnOptions
): Promise<void> {
  const confirmed =
    options.yes || (await deps.prompter.confirm("Measure what this clone consumes?", false));
  if (!confirmed) {
    output.info("Nothing changed.");
    return;
  }
  const choice = await deps.telemetry.chooseIdentity.execute({
    ...options,
    cwd: projectRoot,
    onRefused: () => printIdentityRule(output),
  });
  const result = await deps.telemetry.enableTelemetry.execute({ cwd: projectRoot, choice });
  const retention =
    result.status === "on"
      ? await deps.telemetry.readTranscriptRetention.execute({ root: result.root })
      : undefined;
  printOnResult(output, result, retention);
  if (result.status === "refused") output.exit(1);
}

export function configureOn(
  command: Command,
  { program, createDeps, requests }: TelemetrySurface
): void {
  command
    .description("Measure this clone")
    .option("--yes", "Do not ask first", false)
    .option("--as <id>", "Name you by this identifier on your own measurement")
    .option("--anonymous", "Name nobody on your own measurement", false)
    .action(async (cmdOptions: OnOptions) => {
      const { output, projectRoot, runChecked } = commandOf(program, createDeps);
      await runChecked(
        () =>
          requests.checkOnRequest.execute({
            ...cmdOptions,
            interactive: process.stdout.isTTY === true,
          }),
        (deps) => turnOn(deps, { output, projectRoot }, cmdOptions)
      );
    });
}

export function configureOff(command: Command, { program, createDeps }: TelemetrySurface): void {
  command.description("Stop measuring this clone; what was measured stays").action(async () => {
    const { output, projectRoot, run } = commandOf(program, createDeps);
    await run(async (deps) => {
      const result = await deps.telemetry.disableTelemetry.execute({ cwd: projectRoot });
      printOffResult(output, result);
      if (result.status === "refused") output.exit(1);
    });
  });
}

export function configureForget(command: Command, { program, createDeps }: TelemetrySurface): void {
  command
    .description("Show everything measurement keeps on this machine, or remove it with --yes")
    .option("--yes", "Remove it, instead of only showing it", false)
    .action(async (cmdOptions: { yes: boolean }) => {
      const { output, run } = commandOf(program, createDeps);
      await run(async (deps) => {
        printForgetResult(
          output,
          await deps.telemetry.forgetTelemetry.execute({ confirmed: cmdOptions.yes })
        );
      });
    });
}

export function configureIdentity(
  command: Command,
  { program, createDeps, requests }: TelemetrySurface
): void {
  command
    .description("Choose to be named on your own measurement, or show or remove that choice")
    .option("--off", "Stop naming you and remove the identity", false)
    .action(async (id: string | undefined, cmdOptions: { off: boolean }) => {
      const { output, runChecked } = commandOf(program, createDeps);
      await runChecked(
        () => requests.resolveIdentityRequest.execute({ off: cmdOptions.off, id }),
        async (deps, request) => {
          const result = await deps.telemetry.manageIdentity.execute(request);
          printIdentityResult(output, result);
          if (result.status === "refused") output.exit(1);
        }
      );
    });
}
