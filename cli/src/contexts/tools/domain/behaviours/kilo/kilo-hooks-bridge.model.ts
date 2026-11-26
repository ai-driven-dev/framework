/**
 * Kilo's event bridge for one plugin's hooks.json, on OpenCode's event shapes.
 *
 * Limit: a follow-up sent from `dispose` fails: `kilo run` drains and exits before it.
 * Limit: no person channel; a plugin's toast was never seen rendered.
 */

import { type BridgeParts, generateBridge } from "../../bridges/event-bridge.js";
import type { GeneratedBridge } from "../../formats/hooks/flat-routes.js";

const KILO_HOST = {
  identifierSuffix: "KiloHooks",
  label: "Kilo",
  render: (parts: BridgeParts): string => `${parts.header}
${parts.body}

const ${parts.identifier} = async ({ directory, client }) =>
  bridgeHooks({ directory, client, followUp: "promptAsync" });

export default { id: ${parts.descriptorId}, server: ${parts.identifier} };
`,
};

/** A plugin's raw hooks.json + its name -> its generated Kilo bridge module, and the events it
 * leaves out. */
export function generateKiloHooksBridge(rawHooksJson: string, plugin: string): GeneratedBridge {
  return generateBridge(KILO_HOST, rawHooksJson, plugin);
}
