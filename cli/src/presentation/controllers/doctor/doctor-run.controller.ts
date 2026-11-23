import type { ReportStatus } from "../../../contexts/installation/application/report-status.use-case.js";
import type { DoctorAll } from "../../../orchestration/doctor/doctor-all.js";
import type { ReportAllStatus } from "../../../orchestration/doctor/report-all-status.js";
import type { RunDoctor } from "../../../orchestration/doctor/run-doctor.use-case.js";
import type { RunUserScopeDoctor } from "../../../orchestration/doctor/run-user-scope-doctor.use-case.js";
import type { Output } from "../../../orchestration/domain/output.js";

/** What this command reads of the container. */
export interface DoctorContainer {
  doctor: {
    doctorAll: { execute: DoctorAll };
    runDoctor: Pick<RunDoctor, "execute">;
    runUserScopeDoctor: Pick<RunUserScopeDoctor, "execute">;
    /** The settings file a tool's host keeps at user scope, or undefined when it has none. */
    userSettingsFileOf: (toolId: string) => string | undefined;
  };
  global: {
    reportAllStatus: { execute: ReportAllStatus };
    reportStatus: Pick<ReportStatus, "execute">;
  };
}

/** What every doctor run is given: the container it reads, where it writes, and the project it checks. */
export interface DoctorRun {
  container: DoctorContainer;
  output: Output;
  projectRoot: string;
}

export interface DoctorCmdOptions {
  tool?: string;
  plugin?: string;
  scope?: string;
  global?: boolean;
}

/** A healthy run says so; anything else fails the process. */
export function concludeDoctor(output: Output, healthy: boolean, message: string): void {
  if (healthy) output.success(message);
  else output.exit(1);
}
