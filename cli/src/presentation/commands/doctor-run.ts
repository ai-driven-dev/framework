import type { Deps } from "../../orchestration/deps.js";
import type { Output } from "../../orchestration/domain/output.js";

/** What this command reads of the graph. */
export type DoctorKeys =
  | "doctorAllUseCase"
  | "statusAllUseCase"
  | "doctorUseCase"
  | "statusUseCase"
  | "runUserScopeDoctor"
  | "homedir"
  | "environment";

/** What every doctor run is given: the graph it reads, where it writes, and the project it checks. */
export interface DoctorRun {
  deps: Pick<Deps, DoctorKeys>;
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
