import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import type { SetAgentModels } from "../../../orchestration/agent-models/set-agent-models.use-case.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { Output } from "../../terminal/output.model.js";

export interface AgentModelsReport {
  output: Output;
  catalog: ToolCatalog;
  provider: string | undefined;
  hosts: readonly AiToolId[];
  main: Awaited<ReturnType<SetAgentModels["execute"]>>;
  /** The run left the main session alone, so none is reported. */
  agentsOnly?: boolean;
  /** No provider was named: each tool kept its own, which `main.chosen` says. */
  keepSaved?: boolean;
}

const EVERY_PROJECT = "for every project on this machine";

function reportHostModels(
  { output, catalog, main, agentsOnly }: AgentModelsReport,
  host: AiToolId,
  provider: string
): void {
  const models = catalog.aiProfile(host).agentModels();
  if (models === null) return;
  const skipped = main.skipped.some((entry) => entry.host === host);
  const written = main.changed.findLast((entry) => entry.host === host);
  const { model, effort } = models.mainModel(provider);
  const effortShown = effort === undefined ? "" : ` (${effort})`;
  if (!skipped && agentsOnly !== true) {
    output.info(
      written === undefined
        ? `  ${host} main session: not managed by aidd, still the IDE's choice`
        : `  ${host} main session: ${model}${effortShown}, written in ${written.path}`
    );
  }
  for (const group of models.roleModels(provider)) {
    output.info(`  ${host} ${group.roles.join(", ")}: ${group.model} (${group.effort})`);
  }
}

/** Says, per host, what the main session and each agent now run on, where the main session's
 * model was written, which plugins were updated, and what other projects still need. */
export function reportAgentModels(report: AgentModelsReport): void {
  const { output, provider, main } = report;
  const unchanged = report.agentsOnly === true ? "; main session unchanged" : "";
  if (report.keepSaved === true) reportKeptModels(report, unchanged);
  else if (provider === undefined) reportRestoredModels(report, unchanged);
  else reportConfiguredModels(report, provider, unchanged);
  for (const { host, path, reason } of main.skipped) {
    output.warn(`${host} main session left as it is in ${path}: ${reason}.`);
  }
  output.info(
    main.reinstalled.length > 0
      ? `Agents updated: ${main.reinstalled.join(", ")}.`
      : "Agents installed later get these models too."
  );
  output.info(
    `Other projects follow at their next install; to update the agents they already have, run \`${repeatedRun(report)}\` there.`
  );
}

/** The run that repeats this one in another project. */
function repeatedRun({ hosts, provider, keepSaved, agentsOnly }: AgentModelsReport): string {
  const named = keepSaved === true ? "" : ` --provider ${provider ?? "none"}`;
  return `aidd setup --ide ${hosts.join(",")}${named}${agentsOnly === true ? " --agents-only" : ""}`;
}

function reportRestoredModels({ output, hosts, main }: AgentModelsReport, unchanged: string): void {
  output.success(`${hosts.join(", ")}: the agents run on the IDE's model again${unchanged}.`);
  for (const { host, path } of main.changed)
    output.info(`  ${host} main session: restored in ${path}`);
}

function reportConfiguredModels(
  report: AgentModelsReport,
  provider: string,
  unchanged: string
): void {
  report.output.success(`Models on ${provider}, ${EVERY_PROJECT}${unchanged}:`);
  for (const host of report.hosts) reportHostModels(report, host, provider);
}

function reportKeptModels(report: AgentModelsReport, unchanged: string): void {
  report.output.success(
    `Models on each tool's saved choice, else its first provider, ${EVERY_PROJECT}${unchanged}:`
  );
  for (const host of report.hosts) {
    const provider = report.main.chosen.get(host);
    if (provider === undefined) {
      report.output.info(`  ${host} on the IDE's model`);
      continue;
    }
    report.output.info(`  ${host} on ${provider}`);
    reportHostModels(report, host, provider);
  }
}
