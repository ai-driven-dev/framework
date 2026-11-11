import { FlatPlugins } from "./flat-plugins.js";
import { NativePlugins } from "./native-plugins.js";
import type { PluginsParams } from "./plugin-params.js";
import { UnsupportedPlugins } from "./unsupported-plugins.js";

function deliveryFor(params: PluginsParams): PluginsCapability {
  if (params.mode === "native") return new NativePlugins(params);
  if (params.mode === "flat") return new FlatPlugins(params);
  return new UnsupportedPlugins(params);
}

/**
 * How a tool takes plugins, declared once by its profile: the declaration picks the variant
 * (native, flat, unsupported) that holds the data, and no field of it is readable from outside.
 */
export type PluginsCapability = NativePlugins | FlatPlugins | UnsupportedPlugins;

/** The variant of a plugin capability that installs natively. */
export type NativePluginsCapability = Extract<PluginsCapability, { kind: "native" }>;

export function pluginsCapability(params: PluginsParams): PluginsCapability {
  return deliveryFor(params);
}
