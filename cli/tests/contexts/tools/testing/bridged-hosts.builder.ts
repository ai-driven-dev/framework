/**
 * The hosts whose loader reads no hooks file, OpenCode and Kilo: what a bridge test needs to know
 * of each, and the one way a test places the bridge generated for one and loads it as the host does.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { generateKiloHooksBridge } from "../../../../src/contexts/tools/domain/behaviours/kilo/kilo-hooks-bridge.model.js";
import { generateOpencodeHooksBridge } from "../../../../src/contexts/tools/domain/behaviours/opencode/opencode-hooks-bridge.model.js";
import { madeFolder } from "./made-folders.builder.js";

export const ROOT = "$" + "{CLAUDE_PLUGIN_ROOT}";
/** A hooks.json whose one `event` group runs these commands, in order. */
export const hooksOf = (event: string, ...commands: (string | undefined)[]) =>
  JSON.stringify({
    hooks: { [event]: [{ hooks: commands.map((command) => ({ type: "command", command })) }] },
  });
/** A hooks.json group running one of the plugin's scripts, under node unless `prefix` says. */
export const command = (script: string, prefix = "node ") => ({
  hooks: [{ type: "command", command: `${prefix}${ROOT}/hooks/${script}` }],
});

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

export interface Prompt {
  readonly path: { readonly id: string };
  readonly body: { readonly parts: readonly unknown[] };
}

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

/** A host's session client as its bridge sees it, recording every prompt the bridge sends:
 * `refusal` rejects each one, and `deliver` is how the host's follow-up call lands, once queued. */
export function promptRecorder(
  host: BridgedHost,
  {
    refusal,
    deliver,
  }: { readonly refusal?: Error; readonly deliver?: (r: Prompt) => Promise<void> } = {}
) {
  const prompts: Prompt[] = [];
  const queue = (request: Prompt) => {
    prompts.push(request);
    return refusal === undefined ? Promise.resolve() : Promise.reject(refusal);
  };
  const prompt =
    deliver === undefined
      ? queue
      : async (request: Prompt) => {
          await queue(request);
          await deliver(request);
        };
  return { prompts, queue, session: sessionOf(host, { prompt, promptAsync: queue }) };
}

/** Every line of a JSON-lines record a test's scripts appended to, none while it does not exist. */
export async function jsonLines<T>(path: string): Promise<T[]> {
  return (await readFile(path, "utf8").catch(() => ""))
    .split("\n")
    .filter(Boolean)
    .map((line): T => JSON.parse(line));
}

/**
 * Makes a folder and writes the bridge generated for `plugin` into it where a build puts it,
 * beside the events adapter OpenCode's module imports (`eventsAdapter`, the shipped one unless a
 * test replaces it), with `scripts` in the plugin's scripts folder, by their path there. Returns
 * the folder, the scripts folder and the module's URL.
 */
export async function placeBridge({
  prefix,
  plugin,
  bridge,
  scripts: written,
  eventsAdapter,
}: {
  readonly prefix: string;
  readonly plugin: string;
  readonly bridge: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly eventsAdapter?: string;
}): Promise<{ readonly dir: string; readonly scripts: string; readonly module: string }> {
  const dir = await madeFolder(prefix);
  const scripts = join(dir, "hooks", plugin);
  await mkdir(join(dir, "plugin"), { recursive: true });
  for (const [name, content] of Object.entries(written)) {
    await mkdir(dirname(join(scripts, name)), { recursive: true });
    await writeFile(join(scripts, name), content);
  }
  await writeFile(
    join(dir, "hooks", "opencode-events.js"),
    eventsAdapter ?? (await readFile(OPENCODE_EVENTS, "utf8"))
  );
  const path = join(dir, "plugin", `${plugin}-hooks.mjs`);
  await writeFile(path, bridge);
  return { dir, scripts, module: pathToFileURL(path).href };
}

/** The default descriptor of a placed bridge module, loaded as the host does. */
export async function descriptorOf<D>(module: string): Promise<D> {
  const loaded: { default?: D } = await import(module);
  if (loaded.default === undefined) throw new Error("the bridge exports no descriptor");
  return loaded.default;
}
