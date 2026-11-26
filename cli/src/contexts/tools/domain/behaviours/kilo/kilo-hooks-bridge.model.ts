/**
 * Kilo loads JavaScript modules from `.kilo/plugin/` and requires a default descriptor with
 * `{ id, server }`. Declarative hooks.json has no Kilo runtime, so this generator turns its
 * replayable commands into that native module; what it does on each event is the shared bridge
 * runtime's (`bridges/`), and this file holds only what Kilo does its own way.
 *
 * Kilo shares OpenCode's event shapes and plugin hooks (7.7.5): SessionStart on the first event
 * naming a session, its answer through `experimental.chat.system.transform`; Stop on
 * `session.idle`; PostToolUse on `tool.execute.after`; PreToolUse on `tool.execute.before`, whose
 * throw refuses the call; UserPromptSubmit on `chat.message`, whose throw stops the prompt with a
 * generic UnknownError and no reason (7.8.32), so no script refuses. A required finding queued
 * through `promptAsync` was taken up and the rest of the turn still ran, in one assistant run
 * (7.7.5). A continued Kilo session's first event was not probed; the trigger holds either way.
 *
 * The Stop follow-up goes through `promptAsync`, which returns once queued.
 *
 * Limit: in `kilo run` the follow-up's turn never runs (7.7.5, 7.8.27, 7.8.32). `run` asks the
 * server to drain the session once its prompt returns, and exits at `session.drained`; the drain
 * waits only for prompts already queued, and the event hook that runs the Stop script is not
 * awaited, so the follow-up, sent once the script ended, comes too late. Running the script
 * synchronously inside the event hook made it land, 3 runs of 3 on 7.7.5 and 7.8.32, at the cost
 * of blocking the whole Kilo process for up to the script's 5 s on every idle; that is not done
 * here. Sending it from `dispose` fails: the drain closes before it.
 *
 * Limit: a script's message for the person is not shown. Kilo's TUI subscribes to
 * `tui.toast.show` (`packages/tui/src/app.tsx`, 7.7.5 and 7.8.32), but a plugin's toast rendering
 * was not observed, so the bridge hands Kilo no person channel.
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
