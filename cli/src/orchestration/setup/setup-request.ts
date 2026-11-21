import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { CategoryMismatchError } from "../../shared/domain/errors/category-mismatch-error.js";
import type { AiToolId } from "../../shared/domain/tool.js";

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

/** The tools of this run, each filed under the list its category decides. `--ai` ids must be AI
 * tools; `--ide` ids may be any. */
export function selectTools(
  aiIds: readonly string[],
  ids: readonly string[],
  tools: ToolCatalog
): { aiTools: string[]; ideTools: string[] } {
  const wrong = aiIds.filter((id) => !tools.isAiTool(id));
  if (wrong.length > 0) {
    throw new CategoryMismatchError(wrong, "ai", tools.idsInCanonicalOrder("ai"));
  }
  const unique = [...new Set([...aiIds, ...ids])];
  return {
    aiTools: unique.filter((id) => !tools.isIdeTool(id)),
    ideTools: unique.filter((id) => tools.isIdeTool(id)),
  };
}

/** Whether the run may ask questions: on a terminal, and with no flag that scripts it. */
export function isInteractiveRun(isTty: boolean, scriptingFlags: readonly unknown[]): boolean {
  return isTty && !scriptingFlags.some(Boolean);
}
