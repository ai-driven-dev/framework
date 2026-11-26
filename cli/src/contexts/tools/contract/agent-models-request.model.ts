import type { AiToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "./tool-catalog.js";

/** The tools of this run that run the framework's agents, the provider asked for, and every tool
 * that could run them. A provider no tool knows, or one a tool does not run, is refused before
 * anything is built or written: one provider per run. */
export function agentModelsRequest(
  raw: string | undefined,
  aiTools: readonly string[],
  catalog: ToolCatalog
): { hosts: AiToolId[]; provider: string | undefined; runnable: AiToolId[] } {
  const runsAgents = (id: AiToolId) => catalog.aiProfile(id).agentModels() !== null;
  const hosts = aiTools.flatMap((raw) => {
    const id = catalog.aiToolId(raw);
    return id !== null && runsAgents(id) ? [id] : [];
  });
  const provider = raw === "none" ? undefined : raw;
  const known = catalog.agentProviders();
  if (provider !== undefined && !known.includes(provider)) {
    throw new Error(`Unknown provider "${provider}". Use: ${known.join(", ")}, or none.`);
  }
  if (provider !== undefined) {
    for (const host of hosts) catalog.aiProfile(host).agentModels()?.supportedProvider(provider);
  }
  return { hosts, provider, runnable: catalog.idsInCanonicalOrder("ai").filter(runsAgents) };
}
