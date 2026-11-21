import type { DoctorReport } from "../../contexts/installation/contract/doctor-issue.js";
import type { RunDoctor } from "../doctor/run-doctor.js";
import type { GlobalExecutionError } from "../domain/global-execution.model.js";

export interface DoctorAllResult {
  ai: DoctorReport | null;
  ide: DoctorReport | null;
  /** Plugin issues only. Plugins hang off AI tools, so the ai scope already carries them all. */
  pluginIssues: DoctorReport["pluginIssues"];
  healthy: boolean;
  errors: GlobalExecutionError[];
}

/** The doctor over every category, as a command asks for it. */
export type DoctorAll = (projectRoot: string, pluginName?: string) => Promise<DoctorAllResult>;

/** Runs the doctor once per category and reports both, so one category that cannot be checked
 * never hides the other. */
export async function doctorAll(
  doctor: Pick<RunDoctor, "execute">,
  projectRoot: string,
  pluginName?: string
): Promise<DoctorAllResult> {
  const errors: GlobalExecutionError[] = [];
  const ai = await runScope(
    () => doctor.execute({ projectRoot, category: "ai", pluginName }),
    "ai",
    errors
  );
  const ide = await runScope(
    () => doctor.execute({ projectRoot, category: "ide", pluginName }),
    "ide",
    errors
  );
  // A scope that errored is reported by `errors` and has a null report: "could not be checked",
  // never "checked and fine", so it cannot count as healthy.
  const healthy = ai?.healthy === true && ide?.healthy === true;
  return { ai, ide, pluginIssues: ai?.pluginIssues ?? [], healthy, errors };
}

async function runScope<T>(
  fn: () => Promise<T>,
  scope: string,
  errors: GlobalExecutionError[]
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    errors.push({ scope, message: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
