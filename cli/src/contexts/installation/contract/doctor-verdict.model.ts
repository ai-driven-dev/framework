import type { IssueSeverity } from "./doctor-issue.js";

/** One run is healthy when it found nothing above information and no plugin issue. */
export function isReportHealthy(
  issues: readonly { readonly severity: IssueSeverity }[],
  pluginIssues: readonly unknown[]
): boolean {
  return issues.every((issue) => issue.severity === "info") && pluginIssues.length === 0;
}

/** Both scopes are healthy. A scope that errored has no report: "could not be checked", never
 * "checked and fine", so it cannot count as healthy. */
export function areScopesHealthy(
  ai: { readonly healthy: boolean } | null,
  ide: { readonly healthy: boolean } | null
): boolean {
  return ai?.healthy === true && ide?.healthy === true;
}

/** Drift is informational and never gates the exit code; only structural health issues do.
 * A named plugin narrows that gate to its own issues, so a warning the narrowed view never
 * prints cannot flip the exit code. */
export function isDoctorHealthy(
  report: { readonly pluginIssues: readonly unknown[]; readonly healthy: boolean },
  pluginName: string | undefined
): boolean {
  return pluginName !== undefined ? report.pluginIssues.length === 0 : report.healthy;
}
