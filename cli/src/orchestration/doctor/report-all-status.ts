import type {
  ReportStatusResult,
  StatusQuery,
} from "../../contexts/installation/application/report-status.use-case.js";
import type { GlobalExecutionError } from "../global-execution.js";
import { forEachCategory } from "../sync/for-each-category.js";

export interface ReportAllStatusResult {
  aiTools: ReportStatusResult;
  ideTools: ReportStatusResult;
  /** Plugin drift only. Plugins hang off AI tools, so the ai scope already carries them all. */
  pluginDrift: ReportStatusResult["pluginDrift"];
  errors: GlobalExecutionError[];
}

/** The status over every category, as a command asks for it. */
export type ReportAllStatus = (projectRoot: string) => Promise<ReportAllStatusResult>;

/** Reports the status once per category. A category that fails is replaced by an empty in-sync
 * report and listed in `errors`. */
export async function reportAllStatus(
  status: StatusQuery,
  projectRoot: string
): Promise<ReportAllStatusResult> {
  const { results, errors } = await forEachCategory((category) =>
    status.execute({ projectRoot, category })
  );
  const { ai, ide } = results;
  return {
    aiTools: ai ?? emptyReport(),
    ideTools: ide ?? emptyReport(),
    pluginDrift: ai?.pluginDrift ?? [],
    errors,
  };
}

function emptyReport() {
  return { tools: [], pluginDrift: [], inSync: true };
}
