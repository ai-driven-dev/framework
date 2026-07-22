import type { CLIOutput } from "../output.js";

export function printScopeIssues(
  output: CLIOutput,
  label: string,
  report: {
    issues: { severity: string; message: string; fix: string }[];
    pluginIssues: { pluginName: string; toolId: string; issue: string; filePath: string }[];
  } | null
): void {
  if (report === null || (report.issues.length === 0 && report.pluginIssues.length === 0)) return;
  output.print(`\n${label}:`);
  for (const issue of report.issues.filter((i) => i.severity === "info")) {
    output.warn(`  ${issue.message}\n    Fix: ${issue.fix}`);
  }
  for (const issue of report.issues.filter((i) => i.severity !== "info")) {
    const text = `  ${issue.message}\n    Fix: ${issue.fix}`;
    if (issue.severity === "error") output.error(text);
    else output.warn(text);
  }
  for (const pi of report.pluginIssues) {
    output.error(
      `  Plugin ${pi.pluginName} (${pi.toolId}): ${pi.issue} — ${pi.filePath}\n    Fix: Run \`aidd ai restore\``
    );
  }
}
