import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import { CategoryMismatchError } from "../../shared/domain/errors.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { PluginInstallMode } from "./setup-flow.js";

/** The tools of this run that run the framework's agents, and the provider asked for, refused
 * before anything is built or written: one provider per run, so a tool that does not run it is
 * named. */
export function agentModelsRequest(
  raw: string | undefined,
  aiTools: readonly string[],
  catalog: ToolCatalog
): { hosts: AiToolId[]; provider: string | undefined } {
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
  if (raw !== undefined && hosts.length === 0) {
    const all = catalog.idsInCanonicalOrder("ai").filter(runsAgents);
    throw new Error(
      `--provider needs --ide with a tool that runs the framework's agents: ${all.join(", ")}.`
    );
  }
  if (provider !== undefined) {
    for (const host of hosts) catalog.aiProfile(host).agentModels()?.supportedProvider(provider);
  }
  return { hosts, provider };
}

export function expandAllKeyword(raw: string | undefined, all: readonly string[]): string[] {
  if (raw === undefined) return [];
  if (raw.trim() === "all") return [...all];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assertAiToolIds(toolIds: readonly string[], tools: ToolCatalog): void {
  const wrong = toolIds.filter((id) => !tools.isAiTool(id));
  if (wrong.length > 0) {
    throw new CategoryMismatchError(wrong, "ai", tools.idsInCanonicalOrder("ai"));
  }
}

export function parsePluginsFlag(
  raw: string | undefined,
  interactive: boolean
): { mode: PluginInstallMode; names: string[] } {
  if (raw === undefined) return { mode: interactive ? "interactive" : "none", names: [] };
  const value = raw.trim();
  if (value === "none") return { mode: "none", names: [] };
  if (value === "all") return { mode: "all", names: [] };
  if (value === "recommended") return { mode: "recommended", names: [] };
  const names = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { mode: "named", names };
}
