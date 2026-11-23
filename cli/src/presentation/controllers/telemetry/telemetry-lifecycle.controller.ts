import type { Command } from "commander";
import type { Output } from "../../../orchestration/domain/output.js";
import { printIdentityResult } from "../../presenters/telemetry/telemetry-identity.presenter.js";
import {
  printForgetResult,
  printIdentityRule,
  printOffResult,
  printOnResult,
} from "../../presenters/telemetry/telemetry-lifecycle.presenter.js";
import {
  commandOf,
  type TelemetryContainer,
  type TelemetrySurface,
} from "./telemetry-surface.controller.js";

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
  container: TelemetryContainer,
  { output, projectRoot }: Where,
  options: OnOptions
): Promise<void> {
  const confirmed =
    options.yes ||
    (await container.shared.prompter.confirm("Measure what this clone consumes?", false));
  if (!confirmed) {
    output.info("Nothing changed.");
    return;
  }
  const choice = await container.telemetry.chooseIdentity.execute({
    ...options,
    cwd: projectRoot,
    onRefused: () => printIdentityRule(output),
  });
  const result = await container.telemetry.enableTelemetry.execute({ cwd: projectRoot, choice });
  const retention =
    result.status === "on"
      ? await container.telemetry.readTranscriptRetention.execute({ root: result.root })
      : undefined;
  printOnResult(output, result, retention);
  if (result.status === "refused") output.exit(1);
}

export function configureOn(
  command: Command,
  { program, containerOf, requests }: TelemetrySurface
): void {
  command
    .description("Measure this clone")
    .option("--yes", "Do not ask first", false)
    .option("--as <id>", "Name you by this identifier on your own measurement")
    .option("--anonymous", "Name nobody on your own measurement", false)
    .action(async (cmdOptions: OnOptions) => {
      const { output, projectRoot, runChecked } = commandOf(program, containerOf);
      await runChecked(
        () =>
          requests.checkTelemetryOn.execute({
            ...cmdOptions,
            interactive: process.stdout.isTTY === true,
          }),
        (container) => turnOn(container, { output, projectRoot }, cmdOptions)
      );
    });
}

export function configureOff(command: Command, { program, containerOf }: TelemetrySurface): void {
  command.description("Stop measuring this clone; what was measured stays").action(async () => {
    const { output, projectRoot, run } = commandOf(program, containerOf);
    await run(async (container) => {
      const result = await container.telemetry.disableTelemetry.execute({ cwd: projectRoot });
      printOffResult(output, result);
      if (result.status === "refused") output.exit(1);
    });
  });
}

export function configureForget(
  command: Command,
  { program, containerOf }: TelemetrySurface
): void {
  command
    .description("Show everything measurement keeps on this machine, or remove it with --yes")
    .option("--yes", "Remove it, instead of only showing it", false)
    .action(async (cmdOptions: { yes: boolean }) => {
      const { output, run } = commandOf(program, containerOf);
      await run(async (container) => {
        printForgetResult(
          output,
          await container.telemetry.forgetTelemetry.execute({ confirmed: cmdOptions.yes })
        );
      });
    });
}

export function configureIdentity(
  command: Command,
  { program, containerOf, requests }: TelemetrySurface
): void {
  command
    .description("Choose to be named on your own measurement, or show or remove that choice")
    .option("--off", "Stop naming you and remove the identity", false)
    .action(async (id: string | undefined, cmdOptions: { off: boolean }) => {
      const { output, runChecked } = commandOf(program, containerOf);
      await runChecked(
        () => requests.parseIdentityFlags.execute({ off: cmdOptions.off, id }),
        async (container, request) => {
          const result = await container.telemetry.manageIdentity.execute(request);
          printIdentityResult(output, result);
          if (result.status === "refused") output.exit(1);
        }
      );
    });
}
