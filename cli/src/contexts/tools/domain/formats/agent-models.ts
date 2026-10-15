import models from "./agent-models.json" with { type: "json" };

type ModelHost = keyof typeof models.tools;

/** Native agent fields shared by ordinary installation and build projections. */
export function agentModelOptions(
  host: ModelHost,
  frontmatter: Record<string, unknown>,
  plugin?: string,
  fileName?: string,
  mode: "flat" | "marketplace" = "flat",
  configuration: typeof models = models
): Record<string, unknown> {
  const target = configuration.tools[host];
  const native: Record<string, unknown> = {};
  if (frontmatter.model !== undefined) native.model = frontmatter.model;
  if ("effortField" in target && frontmatter[target.effortField] !== undefined)
    native[target.effortField] = frontmatter[target.effortField];
  if (frontmatter.model !== undefined) return native;
  const role = fileName?.split("/").at(-1)?.replace(/\.md$/, "") ?? frontmatter.name;
  if (
    plugin !== configuration.plugin ||
    typeof role !== "string" ||
    !configuration.roles.includes(role)
  )
    return native;
  if (mode === "marketplace" && "marketplace" in target && !target.marketplace) return native;
  const provider = Object.entries(configuration.providers).find(
    ([name]) => name === target.provider
  )?.[1];
  if (provider === undefined) throw new Error(`Unknown agent model provider: ${target.provider}`);
  const nativeModel =
    "nativeModels" in provider
      ? (Object.entries(provider.nativeModels).find(([tool]) => tool === host)?.[1] ??
        provider.model)
      : provider.model;
  const model = `${"providerPrefix" in target && target.providerPrefix ? `${target.provider}/` : ""}${nativeModel}`;
  if ("effortField" in target) {
    native.model = model;
    native[target.effortField] ??= provider.effort;
  } else {
    native.model = `${model}${target.effortPrefix}${provider.effort}${target.effortSuffix}`;
  }
  return native;
}
