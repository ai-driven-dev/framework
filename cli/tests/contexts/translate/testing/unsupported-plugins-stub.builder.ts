import type { UnsupportedPluginAnswers } from "../../../../src/contexts/tools/contract/tool-profile.js";
import { pluginDeliveryAccepting } from "./plugin-delivery-stub.builder.js";

/** A tool that takes no plugin, and says why it runs none of its hooks. */
export function unsupportedPluginsStub(reason = "synthetic"): UnsupportedPluginAnswers {
  return { ...pluginDeliveryAccepting({ accepts: false, reason }), kind: "unsupported" };
}
