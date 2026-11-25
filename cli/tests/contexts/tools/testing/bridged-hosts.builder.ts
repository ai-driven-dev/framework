/**
 * The hosts whose loader reads no hooks file, OpenCode and Kilo: what a bridge test needs to know
 * of each, and the one way a test places the bridge generated for one and loads it as the host does.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { generateKiloHooksBridge } from "../../../../src/contexts/tools/domain/behaviours/kilo/kilo-hooks-bridge.model.js";
import { generateOpencodeHooksBridge } from "../../../../src/contexts/tools/domain/behaviours/opencode/opencode-hooks-bridge.model.js";

export type BridgedHostId = "opencode" | "kilo";

export interface BridgedHost {
  readonly id: BridgedHostId;
  /** Its name in what its bridge logs. */
  readonly label: string;
  readonly generate: (hooksJson: string, plugin: string) => string | null;
  /** What the host loads of the descriptor. */
  readonly descriptorKeys: readonly string[];
  /** The client call its bridge sends a Stop follow-up through. */
  readonly followUp: "prompt" | "promptAsync";
}

export const BRIDGED_HOSTS: readonly BridgedHost[] = [
  {
    id: "opencode",
    label: "OpenCode",
    generate: (hooksJson, plugin) => generateOpencodeHooksBridge(hooksJson, plugin).content,
    descriptorKeys: ["id", "server", "setup"],
    followUp: "prompt",
  },
  {
    id: "kilo",
    label: "Kilo",
    generate: (hooksJson, plugin) => generateKiloHooksBridge(hooksJson, plugin).content,
    descriptorKeys: ["id", "server"],
    followUp: "promptAsync",
  },
];

export function bridgedHost(id: BridgedHostId): BridgedHost {
  const host = BRIDGED_HOSTS.find((candidate) => candidate.id === id);
  if (host === undefined) throw new Error(`no bridged host ${id}`);
  return host;
}

type Send = (request: never) => Promise<unknown>;

/** The session calls a host's client offers its bridge: its own follow-up call, and
 * `promptAsync`, through which both queue a required finding. */
export function sessionOf(
  host: BridgedHost,
  calls: { readonly prompt: Send; readonly promptAsync: Send }
): Record<string, Send> {
  return { promptAsync: calls.promptAsync, [host.followUp]: calls[host.followUp] };
}

/** The events adapter a build ships beside OpenCode's bridge, which its module imports. */
const OPENCODE_EVENTS = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "assets",
  "configs",
  "opencode",
  "opencode-events.js.txt"
);

/**
 * Writes the bridge generated for `plugin` into `dir` where a build puts it, beside the events
 * adapter OpenCode's module imports (`eventsAdapter`, the shipped one unless a test replaces it),
 * and makes the plugin's scripts folder. Returns that folder and the module's URL.
 */
export async function placeBridge(
  dir: string,
  plugin: string,
  bridge: string,
  eventsAdapter?: string
): Promise<{ readonly scripts: string; readonly module: string }> {
  const scripts = join(dir, "hooks", plugin);
  await mkdir(scripts, { recursive: true });
  await mkdir(join(dir, "plugin"), { recursive: true });
  await writeFile(
    join(dir, "hooks", "opencode-events.js"),
    eventsAdapter ?? (await readFile(OPENCODE_EVENTS, "utf8"))
  );
  const path = join(dir, "plugin", `${plugin}-hooks.mjs`);
  await writeFile(path, bridge);
  return { scripts, module: pathToFileURL(path).href };
}

/** The default descriptor of a placed bridge module, loaded as the host does. */
export async function descriptorOf<D>(module: string): Promise<D> {
  const loaded: { default?: D } = await import(module);
  if (loaded.default === undefined) throw new Error("the bridge exports no descriptor");
  return loaded.default;
}
