import { parseFrontmatter, serializeFrontmatter } from "../../../../kernel/markdown.js";
import type { ToolBuildContract } from "../build-contract.js";
import models from "./agent-models.json" with { type: "json" };

/** How much model a piece of work needs, from `smart` down to `light`; `agent-models.json`
 * describes each and says which one the main session and each agent role run on. */
export type ModelTier = "smart" | "standard" | "light";

export type AgentProvider = keyof typeof models.providers;
export type AgentHost = keyof typeof models.hosts;

/** One tier at one provider. `nativeModels` holds the id a host spells differently. */
export interface ModelProfile {
  readonly model: string;
  readonly effort: string;
  readonly nativeModels?: Readonly<Partial<Record<AgentHost, string>>>;
}

/** The user settings file where a host reads its main-session model. */
export interface MainSettings {
  /** Its JSON file name, read from the host's machine-wide directory where the host declares
   * no user settings path of its own. */
  readonly file: string;
  /** The host's key for the effort, absent where its settings take none. */
  readonly effortKey?: string;
}

export interface HostModels {
  readonly providers: readonly AgentProvider[];
  /** The host names a model `<provider>/<model>`. */
  readonly providerPrefix?: boolean;
  readonly main?: MainSettings;
}

export interface AgentModels {
  readonly tiers: Readonly<Record<ModelTier, string>>;
  /** The tier the main session runs on. */
  readonly main: ModelTier;
  /** Each shipped agent's tier, by its file name. */
  readonly roles: Readonly<Record<string, ModelTier>>;
  readonly providers: Readonly<Record<AgentProvider, Readonly<Record<ModelTier, ModelProfile>>>>;
  readonly hosts: Readonly<Record<AgentHost, HostModels>>;
}

/** JSON imports widen every string, so the tier names are checked by the unit test that reads
 * this table, not by the compiler. */
export const AGENT_MODELS = models as AgentModels;

export function agentProviders(): readonly AgentProvider[] {
  return Object.keys(AGENT_MODELS.providers) as AgentProvider[];
}

export function agentHostIds(): readonly AgentHost[] {
  return Object.keys(AGENT_MODELS.hosts) as AgentHost[];
}

export function isAgentHost(id: string): id is AgentHost {
  return Object.hasOwn(AGENT_MODELS.hosts, id);
}

/** The provider, once the host is known to run it. */
export function supportedProvider(host: string, provider: string): AgentProvider {
  if (!isAgentHost(host)) throw new Error(`No agent provider is supported for "${host}".`);
  const providers: readonly string[] = AGENT_MODELS.hosts[host].providers;
  if (!providers.includes(provider)) {
    throw new Error(
      `Provider "${provider}" is not supported for "${host}". Use: ${providers.join(", ")}.`
    );
  }
  return provider as AgentProvider;
}

/** A tier's model and effort at the provider, in the host's own model ids. */
export function tierModel(
  host: AgentHost,
  provider: AgentProvider,
  tier: ModelTier
): { model: string; effort: string } {
  const profile = AGENT_MODELS.providers[provider][tier];
  const prefix = AGENT_MODELS.hosts[host].providerPrefix === true ? `${provider}/` : "";
  return {
    model: `${prefix}${profile.nativeModels?.[host] ?? profile.model}`,
    effort: profile.effort,
  };
}

/** The agent roles that run on each tier at the provider, in the host's own ids, highest tier
 * first. */
export function roleModels(
  host: AgentHost,
  provider: AgentProvider
): readonly {
  readonly roles: readonly string[];
  readonly model: string;
  readonly effort: string;
}[] {
  const tiers = Object.keys(AGENT_MODELS.tiers) as ModelTier[];
  return tiers.flatMap((tier) => {
    const roles = Object.keys(AGENT_MODELS.roles).filter(
      (role) => AGENT_MODELS.roles[role] === tier
    );
    return roles.length === 0 ? [] : [{ roles, ...tierModel(host, provider, tier) }];
  });
}

/** Gives every agent whose role `agent-models.json` lists its tier's model and effort at the
 * provider, before the host writes it. A model the agent declares itself is kept. */
export function withAgentModels(
  contract: ToolBuildContract,
  host: string,
  provider: string
): ToolBuildContract {
  const chosen = supportedProvider(host, provider);
  const target = host as AgentHost;
  const agents = contract.artifacts.agents;
  if (!agents.supported) return contract;
  const write = agents.transform ?? ((content: string) => content);
  const transform = (content: string, plugin: string, fileName: string): string => {
    const { frontmatter, body } = parseFrontmatter(content);
    const role = fileName.replace(/\.md$/, "");
    const tier = Object.hasOwn(AGENT_MODELS.roles, role) ? AGENT_MODELS.roles[role] : undefined;
    if (tier === undefined || frontmatter.model !== undefined) {
      return write(content, plugin, fileName);
    }
    const modelled = { ...frontmatter, ...tierModel(target, chosen, tier) };
    return write(serializeFrontmatter(modelled, body), plugin, fileName);
  };
  return { ...contract, artifacts: { ...contract.artifacts, agents: { ...agents, transform } } };
}
