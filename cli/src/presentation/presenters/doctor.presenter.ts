import type { AuthenticationFix } from "../../contexts/auth/contract/authentication-issue.js";
import type { RegistrationFix } from "../../contexts/host-registration/contract/registration-issue.js";
import type { DoctorFix } from "../../contexts/installation/contract/doctor-issue.js";
import { render } from "../errors/error-translator.presenter.js";
import type { Output } from "../terminal/output.model.js";
import { printPluginDrift, printScopeReport } from "./setup/status.presenter.js";

/** What a person does about a doctor issue, whichever context found it. */
type IssueFix = string | DoctorFix | RegistrationFix | AuthenticationFix;

type PluginIssue = { pluginName: string; toolId: string; issue: string; filePath?: string };

interface ScopeDriftReport {
  tools: {
    toolId: string;
    version: string;
    drifted: { status: string; relativePath: string }[];
  }[];
}

interface PluginDriftReport {
  pluginDrift: {
    pluginName: string;
    toolId: string;
    driftedFiles: string[];
    notInstalledOnMachine: boolean;
  }[];
}

interface Inventory {
  label: string;
  doctorReport: {
    readonly toolHealth: readonly {
      readonly toolId: string;
      readonly fileCount: number;
      readonly mergeFileCount: number;
    }[];
  } | null;
  statusTools: readonly { toolId: string; version: string }[];
}

/** Which tools are equipped and how much they carry, independent of health and drift, which
 * are reported separately. Versions come from the status report already fetched for drift. */
export function printInventory(
  output: Output,
  { label, doctorReport, statusTools }: Inventory
): void {
  const health = doctorReport?.toolHealth ?? [];
  if (health.length === 0) return;
  output.print(`\n${label} tools:`);
  for (const h of health) {
    const version = statusTools.find((t) => t.toolId === h.toolId)?.version ?? "unknown";
    output.print(
      `  ${h.toolId} (v${version}): ${h.fileCount} files, ${h.mergeFileCount} merge files`
    );
  }
}

export function printReportErrors(
  output: Output,
  errors: readonly { scope: string; error: unknown }[]
): void {
  for (const e of errors) output.warn(`[${e.scope}] ${render(e.error)}`);
}

export function printAllToolsDrift(
  output: Output,
  status: { aiTools: ScopeDriftReport; ideTools: ScopeDriftReport } & PluginDriftReport
): void {
  output.print("\nDrift:");
  output.print("AI tools:");
  printScopeReport(output, status.aiTools);
  output.print("IDE tools:");
  printScopeReport(output, status.ideTools);
  output.print("Plugins:");
  printPluginDrift(output, { pluginDrift: status.pluginDrift });
}

export function printToolDrift(output: Output, status: ScopeDriftReport & PluginDriftReport): void {
  output.print("\nDrift:");
  printScopeReport(output, status);
  output.print("Plugins:");
  printPluginDrift(output, { pluginDrift: status.pluginDrift });
}

export function printUserScopeTools(
  output: Output,
  tools: readonly { toolId: string; version: string; settings: string }[]
): void {
  output.print("User-scope tools:");
  for (const tool of tools) {
    output.print(`  ${tool.toolId} (v${tool.version}): expects activation in ${tool.settings}`);
  }
}

export function printScopeIssues(
  output: Output,
  label: string,
  report: {
    issues: { severity: string; message: string; fix: IssueFix }[];
  } | null
): void {
  if (report === null || report.issues.length === 0) return;
  output.print(`\n${label}:`);
  for (const issue of report.issues.filter((i) => i.severity === "info")) {
    output.warn(`  ${issue.message}\n    Fix: ${describeDoctorFix(issue.fix)}`);
  }
  for (const issue of report.issues.filter((i) => i.severity !== "info")) {
    const text = `  ${issue.message}\n    Fix: ${describeDoctorFix(issue.fix)}`;
    if (issue.severity === "error") output.error(text);
    else output.warn(text);
  }
}

export function printPluginIssues(output: Output, pluginIssues: readonly PluginIssue[]): void {
  if (pluginIssues.length === 0) return;
  output.print("\nPlugins:");
  const notInstalled = pluginIssues.filter((pi) => pi.issue === "not-installed-on-machine");
  const toolIds = new Set(notInstalled.map((pi) => pi.toolId));
  for (const toolId of toolIds) {
    output.error(`  ${toolId}: plugins not installed on this machine, run \`aidd sync\``);
  }
  for (const pi of pluginIssues.filter((pi) => pi.issue !== "not-installed-on-machine")) {
    output.error(
      `  Plugin ${pi.pluginName} (${pi.toolId}): ${pi.issue} — ${pi.filePath}\n    Fix: Run \`aidd sync\``
    );
  }
}

const SYNC_FORCE_EFFECT = {
  "reinstall-files": "reinstall tracked files",
  "revert-file": "revert to the framework version",
  "restore-keys": "restore managed keys",
  "restore-value": "restore the original value",
} as const;

/** The words of what a person does about a doctor issue. */
export function describeDoctorFix(fix: IssueFix): string {
  if (typeof fix === "string") return fix;
  switch (fix.code) {
    case "remove-or-track-directory":
      return "Remove the directory manually, or run `aidd install <tool>` to track it.";
    case "restore-or-sync":
      return "Restore the file or run `aidd sync` to reinstall tracked files.";
    case "sync-force":
      return `Run \`aidd sync --force\` to ${SYNC_FORCE_EFFECT[fix.effect]}.`;
    case "sync-reregister":
      return "Run `aidd sync` to re-register it.";
    case "sync-migrate-source":
      return "Run `aidd sync` to move it to the shared, machine-scope source.";
    case "update-cli":
      return "Run `aidd update` to bring this project's CLI to at least the version the host already follows.";
    case "authenticate":
      return "Run aidd auth login";
    case "install-framework":
      return `Run \`aidd framework install --tool ${fix.tool}\`.`;
    case "replace-conflicting-source":
      return `Run \`claude plugin marketplace remove ${fix.name}\`, then \`aidd sync\` to re-register it for this project — or rename this project's marketplace if it is meant to point elsewhere.`;
    case "refresh-marketplace":
      return `Run \`aidd marketplace refresh\` to write it back to ${fix.file}.`;
    case "repair-settings-file":
      return `Repair the JSON in ${fix.file} by hand, then run \`aidd marketplace refresh\`.`;
    case "remove-stale-declaration":
      return `Remove the \`${fix.name}\` entry from ${fix.file}, or run \`aidd marketplace refresh\` if the project registers it again.`;
  }
}
