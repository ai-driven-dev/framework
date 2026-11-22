import type { DoctorReport } from "../../contexts/installation/contract/doctor-issue.js";
import type { RunDoctor } from "../doctor/run-doctor.use-case.js";
import type { GlobalExecutionError } from "../domain/global-execution.model.js";
import { forEachCategory } from "./for-each-category.js";

export interface DoctorAllResult {
  ai: DoctorReport | null;
  ide: DoctorReport | null;
  /** Plugin issues only. Plugins hang off AI tools, so the ai scope already carries them all. */
  pluginIssues: DoctorReport["pluginIssues"];
  /** The doctor's verdict, narrowed to the named plugin's issues when one is given. */
  healthy: boolean;
  errors: GlobalExecutionError[];
}

/** The doctor over every category, as a command asks for it. */
export type DoctorAll = (projectRoot: string, pluginName?: string) => Promise<DoctorAllResult>;

/** Drift is informational and never gates the exit code; only structural health issues do.
 * A named plugin narrows that gate to its own issues, so a warning the narrowed view never
 * prints cannot flip the exit code. */
export function isDoctorHealthy(
  report: { readonly pluginIssues: readonly unknown[]; readonly healthy: boolean },
  pluginName: string | undefined
): boolean {
  return pluginName !== undefined ? report.pluginIssues.length === 0 : report.healthy;
}

/** Runs the doctor once per category and reports both, so one category that cannot be checked
 * never hides the other. */
export async function doctorAll(
  doctor: Pick<RunDoctor, "execute">,
  projectRoot: string,
  pluginName?: string
): Promise<DoctorAllResult> {
  const { results, errors } = await forEachCategory((category) =>
    doctor.execute({ projectRoot, category, pluginName })
  );
  const { ai, ide } = results;
  const pluginIssues = ai?.pluginIssues ?? [];
  // A scope that errored is reported by `errors` and has a null report: "could not be checked",
  // never "checked and fine", so it cannot count as healthy, unless a plugin is named and the
  // verdict rests on its issues alone.
  const healthy =
    pluginName !== undefined
      ? isDoctorHealthy({ pluginIssues, healthy: false }, pluginName)
      : ai?.healthy === true && ide?.healthy === true;
  return { ai, ide, pluginIssues, healthy, errors };
}
