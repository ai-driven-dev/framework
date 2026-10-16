import models from "./agent-models.json" with { type: "json" };

export type AgentHost = keyof typeof models.hosts;
export type AgentProvider = keyof typeof models.providers;

interface AgentModelProfile {
  model: string;
  effort: string;
  nativeModels?: Partial<Record<AgentHost, string>>;
}

export function isAgentHost(value: unknown): value is AgentHost {
  return typeof value === "string" && Object.hasOwn(models.hosts, value);
}

export function isAgentProvider(value: unknown): value is AgentProvider {
  return typeof value === "string" && Object.hasOwn(models.providers, value);
}

export function agentProviderNames(): string[] {
  return Object.keys(models.providers);
}

export function agentIdeNames(): string[] {
  return Object.entries(models.hosts).map(([host, target]) =>
    "ide" in target ? target.ide : host
  );
}

export function resolveAgentHost(ide: string): AgentHost {
  const host = Object.entries(models.hosts).find(
    ([name, target]) => name === ide || ("ide" in target && target.ide === ide)
  )?.[0];
  if (!isAgentHost(host)) throw new Error(`IDE "${ide}" is not supported.`);
  return host;
}

/** Native fields for a configured role on the selected host and provider. */
export function agentModelOptions(
  host: AgentHost,
  provider: AgentProvider,
  role: string
): Record<string, unknown> {
  const target = models.hosts[host];
  if (!target.providers.includes(provider)) {
    throw new Error(`Provider "${provider}" is not supported by "${host}".`);
  }
  const profile = Object.entries(models.roles).find(([name]) => name === role)?.[1];
  if (profile === undefined) throw new Error(`Agent role "${role}" is not configured.`);
  const source: AgentModelProfile | undefined = Object.entries(models.providers[provider]).find(
    ([name]) => name === profile
  )?.[1];
  if (source === undefined)
    throw new Error(`Agent profile "${profile}" is not configured for "${provider}".`);
  const nativeModel = source.nativeModels?.[host] ?? source.model;
  const model = `${"providerPrefix" in target && target.providerPrefix ? `${provider}/` : ""}${nativeModel}`;
  return "effortField" in target
    ? { model, [target.effortField]: source.effort }
    : { model: `${model}${target.effortPrefix}${source.effort}${target.effortSuffix}` };
}
