import type { Command } from "commander";
import type { DeclareTask } from "../../../contexts/telemetry/application/declaration/declare-task.use-case.js";
import type { ParseTaskFlags } from "../../../contexts/telemetry/application/declaration/parse-task-flags.use-case.js";
import type { ForgetTelemetry } from "../../../contexts/telemetry/application/forget/forget-telemetry.use-case.js";
import type { ManageIdentity } from "../../../contexts/telemetry/application/identity/manage-identity.use-case.js";
import type { ParseIdentityFlags } from "../../../contexts/telemetry/application/identity/parse-identity-flags.use-case.js";
import type { ProposeIdentity } from "../../../contexts/telemetry/application/identity/propose-identity.use-case.js";
import type { IngestUsage } from "../../../contexts/telemetry/application/ingest-usage.use-case.js";
import type { ReadTelemetryStatus } from "../../../contexts/telemetry/application/read-telemetry-status.use-case.js";
import type { CheckFilterValue } from "../../../contexts/telemetry/application/report/check-filter-value.use-case.js";
import type { ParseReportFlags } from "../../../contexts/telemetry/application/report/parse-report-flags.use-case.js";
import type { RequestReport } from "../../../contexts/telemetry/application/report/request-report.use-case.js";
import type { CheckTelemetryOn } from "../../../contexts/telemetry/application/switch/check-telemetry-on.use-case.js";
import type { DisableTelemetry } from "../../../contexts/telemetry/application/switch/disable-telemetry.use-case.js";
import type { EnableTelemetry } from "../../../contexts/telemetry/application/switch/enable-telemetry.use-case.js";
import type { ReadTranscriptRetention } from "../../../contexts/telemetry/application/switch/read-transcript-retention.use-case.js";
import type { ChooseIdentity } from "../../../orchestration/telemetry/choose-identity.use-case.js";
import { type ContainerFactory, parseGlobalOptions } from "../menu/global-options.controller.js";

/** The commands a telemetry subcommand runs once the container is built. */
export interface TelemetryCommands {
  declareTask: Pick<DeclareTask, "execute">;
  readTelemetryStatus: Pick<ReadTelemetryStatus, "execute">;
  ingestUsage: Pick<IngestUsage, "execute">;
  requestReport: Pick<RequestReport, "execute">;
  manageIdentity: Pick<ManageIdentity, "execute">;
  proposeIdentity: Pick<ProposeIdentity, "execute">;
  chooseIdentity: Pick<ChooseIdentity, "execute">;
  readTranscriptRetention: Pick<ReadTranscriptRetention, "execute">;
  enableTelemetry: Pick<EnableTelemetry, "execute">;
  disableTelemetry: Pick<DisableTelemetry, "execute">;
  forgetTelemetry: Pick<ForgetTelemetry, "execute">;
}

/** What every telemetry subcommand reads of the container. */
export interface TelemetryContainer {
  shared: { prompter: { confirm(message: string, defaultValue?: boolean): Promise<boolean> } };
  telemetry: TelemetryCommands;
}

/** What a telemetry command's request alone can answer, built with no I/O so a refusal comes
 * before the container is built. */
export interface TelemetryRequests {
  parseTaskFlags: Pick<ParseTaskFlags, "execute">;
  parseReportFlags: Pick<ParseReportFlags, "execute">;
  checkTelemetryOn: Pick<CheckTelemetryOn, "execute">;
  checkFilterValue: Pick<CheckFilterValue, "execute">;
  parseIdentityFlags: Pick<ParseIdentityFlags, "execute">;
}

/** What every subcommand registrar needs to configure its command. */
export interface TelemetrySurface {
  readonly program: Command;
  readonly containerOf: ContainerFactory<TelemetryContainer>;
  readonly requests: TelemetryRequests;
}

/** A command's output and directory, and how it runs: `run` builds the container for some
 * work, `runChecked` first checks what the request alone can answer, before it is built. A
 * failure of either reaches the program's one exit. */
export function commandOf(program: Command, containerOf: ContainerFactory<TelemetryContainer>) {
  const { verbose, output, projectRoot } = parseGlobalOptions(program);
  const wire = () => containerOf(projectRoot, { verbose }, output);
  const run = async (work: (container: TelemetryContainer) => Promise<void>) => work(await wire());
  const runChecked = async <Checked>(
    validate: () => Checked,
    work: (container: TelemetryContainer, checked: Checked) => Promise<void>
  ): Promise<void> => {
    const checked = validate();
    await work(await wire(), checked);
  };
  return { output, projectRoot, run, runChecked };
}
