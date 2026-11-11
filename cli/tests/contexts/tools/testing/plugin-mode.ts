import type { PluginsCapability } from "../../../../src/contexts/tools/domain/plugins/plugins-capability.js";

/** The way a tool takes plugins, read from the answers its capability gives: the declaration's
 * own `mode` is not readable, so the two answers that tell the three apart stand for it. */
export function pluginModeOf(plugins: PluginsCapability): "native" | "flat" | "unsupported" {
  if (plugins.isNative()) return "native";
  return plugins.buildMode() === "flat" ? "flat" : "unsupported";
}
