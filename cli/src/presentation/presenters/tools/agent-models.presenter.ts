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
}

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
  const { output, provider, hosts, main } = report;
  const flag = report.agentsOnly === true ? " --agents-only" : "";
  const unchanged = report.agentsOnly === true ? "; main session unchanged" : "";
  if (provider === undefined) reportRestoredModels(report, unchanged);
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
    `Other projects follow at their next install; to update the agents they already have, run \`aidd setup --ide ${hosts.join(",")} --provider ${provider ?? "none"}${flag}\` there.`
  );
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
  report.output.success(`Models on ${provider}, for every project on this machine${unchanged}:`);
  for (const host of report.hosts) reportHostModels(report, host, provider);
}
