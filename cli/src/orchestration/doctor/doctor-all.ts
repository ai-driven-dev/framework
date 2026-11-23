import {
  areScopesHealthy,
  isDoctorHealthy,
} from "../../contexts/installation/contract/doctor-verdict.model.js";
import type { GlobalExecutionError } from "../global-execution.js";
import { forEachCategory } from "../sync/for-each-category.js";
import type { DoctorReport } from "./doctor-report.js";
import type { RunDoctor } from "./run-doctor.use-case.js";

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
  const healthy = isDoctorHealthy({ pluginIssues, healthy: areScopesHealthy(ai, ide) }, pluginName);
  return { ai, ide, pluginIssues, healthy, errors };
}
