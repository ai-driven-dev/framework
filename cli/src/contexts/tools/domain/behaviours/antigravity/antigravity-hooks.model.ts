import type { ShippedHooks } from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import {
  mergeWrappedCommandHooks,
  type WrappedCommandHooksTarget,
} from "../../hooks/wrapped-command-hooks-merge.js";

export type AntigravityHooks = HooksRouting & {
  readonly flat: FlatHooksRoute;
  readonly eventMap: WrappedCommandHooksTarget["descriptor"]["eventMap"];
  readonly toolNames: WrappedCommandHooksTarget["descriptor"]["toolNames"];
};

function targetOf(hooks: AntigravityHooks): WrappedCommandHooksTarget {
  return { label: "Antigravity", descriptor: hooks };
}

export function mergeAntigravityHooks(
  hooks: AntigravityHooks,
  existingJson: string | null,
  shipped: ShippedHooks
): { content: string; warnings: readonly string[] } {
  return mergeWrappedCommandHooks(targetOf(hooks), existingJson, shipped);
}

/** A plugin's hooks as the `hooks.json` of its own directory, which `agy` runs each handler from:
 * the named group `agy` reads, its scripts named from the project root they run in. */
export function antigravityPluginHooks(
  hooks: AntigravityHooks,
  pluginsDir: string
): (json: string, plugin: string) => string {
  const depth = [...pluginsDir.split("/").filter(Boolean), "plugin"].map(() => "..");
  const target: WrappedCommandHooksTarget = {
    ...targetOf(hooks),
    runsFrom: {
      projectRoot: depth.join("/"),
      pluginDir: (plugin) => `${pluginsDir}${plugin}/`,
    },
  };
  return (json, plugin) => mergeWrappedCommandHooks(target, null, { json, plugin }).content;
}
