/**
 * Generates OpenCode's event bridge for one plugin's hooks.json. OpenCode's loader scans no
 * "hooks" family and this profile writes no hooks.json, so without this module a plugin's
 * declared hooks have no trigger on OpenCode at all. The generated file is a real OpenCode
 * plugin with V1/server and V2/setup entrypoints; what it does on each event is the shared
 * bridge runtime's (`bridges/`), and this file holds only what OpenCode does its own way.
 *
 * V1 (OpenCode 1.19.3) carries the five replayed events:
 *
 * - `SessionStart` on the first event naming a session; its answer through
 *   `experimental.chat.system.transform`, which also runs for the session's title call, not told
 *   apart. A subagent's child session emits its own `session.created`, naming its parent, and
 *   `session.idle` (observed on 1.19.3): SessionStart and Stop skip it.
 * - `Stop` on `session.idle`. The follow-up goes through `session.prompt`, which resolves once its
 *   turn ran: `opencode run` exits once the session is idle, so `dispose` waits for it.
 * - `PostToolUse` on `tool.execute.after`. A required finding is queued through `promptAsync`; on
 *   1.19.3 the model took it up and dropped the original request's last step. Whether it resumes
 *   that request was not probed.
 * - `PreToolUse` on `tool.execute.before`: a throw from that hook refuses the call on 1.19.3.
 * - `UserPromptSubmit` on `chat.message`. A throw from that hook stops the prompt, but its reason
 *   reaches neither the person nor the model (1.19.3 answers a generic server error), so no script
 *   refuses.
 *
 * What a script prints for the person goes to the TUI's toast through the server plugin's own
 * client (`tui.showToast`, captured in `opencode-tui.toast.show.json`); the variant is the
 * bridge's choice, which the host echoes. `opencode run` has no TUI and shows none.
 *
 * Limits of the V2 entrypoint (`setup`, through `opencode-events.js`):
 * - On 1.19.3 OpenCode calls both `server` and `setup`; `setup` sees no location in that early
 *   context and does nothing.
 * - OpenCode 2.4.1 (`@opencode/cli`) runs `setup` alone. It relays only the event stream and
 *   `execute.after`: PreToolUse, UserPromptSubmit and the system-prompt hand-over never run; its
 *   client has no toast, and no `promptAsync`, so a required finding is reported as the call's
 *   PostToolUse failure and the call's later PostToolUse hooks are skipped; and the
 *   `run` session's own `session.created` reaches no plugin, so its SessionStart runs on a later
 *   event. Its tool input names the file `path`, which no `file_path` is derived from. Moving the
 *   bridge onto the V2 plugin API is an open design question.
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
  // OpenCode keeps delivering events to an instance it disposed once it has created the next one.
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
