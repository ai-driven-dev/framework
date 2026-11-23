import type { Command } from "commander";
import type { ContainerFactory } from "../menu/global-options.controller.js";
import {
  configureIngest,
  configureStatus,
  configureTask,
} from "./telemetry-activity.controller.js";
import {
  configureForget,
  configureIdentity,
  configureOff,
  configureOn,
} from "./telemetry-lifecycle.controller.js";
import { configureReport } from "./telemetry-report.controller.js";
import type { TelemetryContainer, TelemetryRequests } from "./telemetry-surface.controller.js";

export function registerTelemetryCommand(
  program: Command,
  containerOf: ContainerFactory<TelemetryContainer>,
  requests: TelemetryRequests
): void {
  const telemetry = program
    .command("telemetry")
    .description("Measure what Claude Code and Codex sessions consume, locally");
  const surface = { program, containerOf, requests };
  configureOn(telemetry.command("on"), surface);
  configureOff(telemetry.command("off"), surface);
  configureForget(telemetry.command("forget"), surface);
  configureIngest(telemetry.command("ingest"), surface);
  configureTask(telemetry.command("task [name]"), surface);
  configureStatus(telemetry.command("status"), surface);
  configureReport(telemetry.command("report"), surface);
  configureIdentity(telemetry.command("identity [id]"), surface);
}
