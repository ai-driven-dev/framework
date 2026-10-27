import { parseFrontmatter, serializeFrontmatter } from "../../../../kernel/markdown.js";
import type { ToolBuildContract } from "../build-contract.js";
import models from "./agent-models.json" with { type: "json" };

type Host = keyof typeof models.hosts;
type Provider = keyof typeof models.providers;

interface ModelProfile {
  readonly model: string;
  readonly effort: string;
  readonly nativeModels?: Readonly<Record<string, string>>;
}

function supportedHost(host: string): Host {
  if (!Object.hasOwn(models.hosts, host)) {
    throw new Error(`No agent provider is supported for "${host}".`);
  }
  return host as Host;
}

function supportedProvider(host: Host, provider: string): Provider {
  const providers: readonly string[] = models.hosts[host].providers;
  if (!providers.includes(provider)) {
    throw new Error(
      `Provider "${provider}" is not supported for "${host}". Use: ${providers.join(", ")}.`
    );
  }
  return provider as Provider;
}

/** The model and effort an agent's role has at the provider, in the host's model ids. */
function roleModel(host: Host, provider: Provider, role: string): ModelProfile | undefined {
  const tier = Object.entries(models.roles).find(([name]) => name === role)?.[1];
  const profile: ModelProfile | undefined = Object.entries(models.providers[provider]).find(
    ([name]) => name === tier
  )?.[1];
  if (profile === undefined) return undefined;
  const prefix = "providerPrefix" in models.hosts[host] ? `${provider}/` : "";
  return {
    model: `${prefix}${profile.nativeModels?.[host] ?? profile.model}`,
    effort: profile.effort,
  };
}

/** Gives every agent whose role `agent-models.json` lists its model and effort at the
 * provider, before the host writes it. A model the agent declares itself is kept. */
export function withAgentModels(
  contract: ToolBuildContract,
  host: string,
  provider: string
): ToolBuildContract {
  const target = supportedHost(host);
  const chosen = supportedProvider(target, provider);
  const agents = contract.artifacts.agents;
  if (!agents.supported) return contract;
  const write = agents.transform ?? ((content: string) => content);
  const transform = (content: string, plugin: string, fileName: string): string => {
    const { frontmatter, body } = parseFrontmatter(content);
    const profile = roleModel(target, chosen, fileName.replace(/\.md$/, ""));
    if (profile === undefined || frontmatter.model !== undefined) {
      return write(content, plugin, fileName);
    }
    const modelled = serializeFrontmatter({ ...frontmatter, ...profile }, body);
    return write(modelled, plugin, fileName);
  };
  return { ...contract, artifacts: { ...contract.artifacts, agents: { ...agents, transform } } };
}
