import type { PluginsCapability } from "../../../../src/contexts/tools/domain/plugins/plugins-capability.js";

type NativeDelivery = Extract<PluginsCapability, { kind: "native" }>;
type FlatDelivery = Extract<PluginsCapability, { kind: "flat" }>;

/** The way a tool takes plugins, as its capability's own `kind` states it. */
export function pluginModeOf(plugins: PluginsCapability): "native" | "flat" | "unsupported" {
  return plugins.kind;
}

/** A test about a native tool's answers: refuses any other kind rather than answering for it. */
export function nativeOf(plugins: PluginsCapability | null | undefined): NativeDelivery {
  if (plugins?.kind !== "native") throw new Error(`expected a native tool, got ${plugins?.kind}`);
  return plugins;
}

/** A test about a flat tool's answers: refuses any other kind rather than answering for it. */
export function flatOf(plugins: PluginsCapability | null | undefined): FlatDelivery {
  if (plugins?.kind !== "flat") throw new Error(`expected a flat tool, got ${plugins?.kind}`);
  return plugins;
}
