import type { Command } from "commander";
import type { Deps, DepsSliceFactory, TelemetryRequests } from "../../../orchestration/deps.js";
import { parseGlobalOptions } from "../menu/global-options.controller.js";

/** What every telemetry subcommand reads of the graph. */
export type TelemetryCommandKeys = "prompter" | "telemetry";

/** What every subcommand registrar needs to configure its command. */
export interface TelemetrySurface {
  readonly program: Command;
  readonly createDeps: DepsSliceFactory<TelemetryCommandKeys>;
  readonly requests: TelemetryRequests;
}

/** A command's output and directory, and how it runs: `run` wires the dependencies for some
 * work, `runChecked` first checks what the request alone can answer, before any are wired. A
 * failure of either reaches the program's one exit. */
export function commandOf(program: Command, createDeps: DepsSliceFactory<TelemetryCommandKeys>) {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const wire = () => createDeps(projectRoot, { verbose }, output);
  const run = async (work: (deps: Pick<Deps, TelemetryCommandKeys>) => Promise<void>) =>
    work(await wire());
  const runChecked = async <Checked>(
    validate: () => Checked,
    work: (deps: Pick<Deps, TelemetryCommandKeys>, checked: Checked) => Promise<void>
  ): Promise<void> => {
    const checked = validate();
    await work(await wire(), checked);
  };
  return { output, projectRoot, run, runChecked };
}
