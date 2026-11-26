/**
 * OpenCode's event bridge for one plugin's hooks.json: its loader reads no hooks file.
 *
 * Limit: V2 setup has no toast and no promptAsync, so no message reaches the person and a required
 * finding is never queued.
 * Limit: V2 never calls V1 dispose.
 * Limit: a Code Mode call was not observed reaching a hook.
 * Limit: a child session's prompt reaches UserPromptSubmit.
 * Limit: a UserPromptSubmit throw carries no reason, so no script refuses.
 */

import { type BridgeParts, generateBridge } from "../../bridges/event-bridge.js";
import type { GeneratedBridge } from "../../formats/hooks/flat-routes.js";

// Every plugin this generator sees is already named "aidd-<something>", so an "Aidd" prefix
// here would stutter rather than name anything the plugin's own PascalCased name does not.
const OPENCODE_HOST = {
  identifierSuffix: "Hooks",
  label: "OpenCode",
  render: (
    parts: BridgeParts
  ): string => `${parts.header} OpenCode's plugin loader scans no "hooks" family,
// so this file is the only trigger this plugin's declared hooks have on OpenCode.
import { setupOpencodeEvents } from "../hooks/opencode-events.js";
${parts.body}

/** The person's message goes to the TUI's toast. Never awaited: the call comes back only once the
 * server is up, and a toast the TUI cannot show is not worth holding a hook for. */
function showToast(client, person) {
  if (!person) return;
  Promise.resolve()
    .then(() => client.tui.showToast({ body: { message: person, variant: "warning" } }))
    .catch(() => {});
}

export const ${parts.identifier} = async (input) => {
  // Stop handlings in flight: \`opencode run\` exits once the session is idle, so dispose waits.
  let pending = Promise.resolve();
  // Limit: an event reaching an instance after its dispose was never captured; a disposed
  // instance relays none, so a Stop is never run by two instances at once.
  let disposed = false;
  const hooks = bridgeHooks({
    directory: input.directory,
    client: input.client,
    followUp: "prompt",
    show: (person) => showToast(input.client, person),
    track: (handling) => {
      pending = Promise.all([pending, handling]).then(() => {});
    },
  });
  return {
    ...hooks,
    dispose: async () => {
      disposed = true;
      await pending;
    },
    event: async (payload) => {
      if (!disposed) await hooks.event(payload);
    },
  };
};

export default {
  id: ${parts.descriptorId},
  server: ${parts.identifier},
  setup: (ctx) => setupOpencodeEvents(ctx, ${parts.identifier}),
};
`,
};

/** A plugin's raw hooks.json + its name -> its generated OpenCode bridge module, and the events
 * it leaves out. */
export function generateOpencodeHooksBridge(rawHooksJson: string, plugin: string): GeneratedBridge {
  return generateBridge(OPENCODE_HOST, rawHooksJson, plugin);
}
