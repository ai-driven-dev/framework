import type {
  ConvertHooks,
  ShippedHooks,
} from "../../../../../shared/domain/materialization/build-contract.js";
import type { ProjectHooksFormat } from "../../../contract/tool-vocabulary.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { pluginScriptDir, pluginScriptPath } from "../../hooks/hooks-merge.js";
import { toolWarning } from "../../hooks/hooks-warnings.js";
import type { WrappedCommandHooksTarget } from "../../hooks/wrapped-command-hooks-convert.js";
import {
  isWrappedCommandHooksFileEmpty,
  unmergeWrappedCommandHooks,
  wrappedCommandHookEntries,
} from "../../hooks/wrapped-command-hooks-file.js";
import { mergeWrappedCommandHooks } from "../../hooks/wrapped-command-hooks-merge.js";
import type { HooksSection, PluginFileDelivery } from "../../sections/hooks-section.js";

export type AntigravityHooks = HooksRouting & {
  readonly flat: FlatHooksRoute & { readonly sharedFile: string };
  readonly eventMap: WrappedCommandHooksTarget["descriptor"]["eventMap"];
  readonly toolNames: WrappedCommandHooksTarget["descriptor"]["toolNames"];
};

function targetOf(hooks: AntigravityHooks): WrappedCommandHooksTarget {
  return { label: "Antigravity", releasesPostToolAnswersAt: "PreInvocation", descriptor: hooks };
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
export function antigravityPluginHooks(hooks: AntigravityHooks, pluginsDir: string): ConvertHooks {
  const depth = [...pluginsDir.split("/").filter(Boolean), "plugin"].map(() => "..");
  const target: WrappedCommandHooksTarget = {
    ...targetOf(hooks),
    runsFrom: {
      projectRoot: depth.join("/"),
      pluginDir: (plugin) => `${pluginsDir}${plugin}/`,
    },
  };
  return (json, plugin, carriesRelease) => {
    const { content, warnings } = mergeWrappedCommandHooks(target, null, {
      json,
      plugin,
      carriesRelease,
    });
    return { content, warnings: warnings.map((warning) => toolWarning("antigravity", warning)) };
  };
}

/** How the project's `.agents/hooks.json` holds a plugin's entries, where an earlier release merged
 * them: read only to take back out what that release recorded. */
function releasedHooksFormat(hooks: AntigravityHooks): ProjectHooksFormat {
  const target = targetOf(hooks);
  return {
    merge: (existing, json, plugin) => mergeAntigravityHooks(hooks, existing, { json, plugin }),
    unmerge: unmergeWrappedCommandHooks,
    contributedEntries: (content, name) => wrappedCommandHookEntries(target, content, name),
    isEmpty: isWrappedCommandHooksFileEmpty,
    scriptPath: (name, rel) => pluginScriptPath(target.descriptor.flat.scriptsDir, name, rel),
    scriptDir: (name) => pluginScriptDir(target.descriptor.flat.scriptsDir, name),
  };
}

/** How `agy` takes a plugin's hooks, and the project file an earlier release merged them into. */
export function antigravityHooksSection(
  hooks: AntigravityHooks,
  delivery: PluginFileDelivery
): HooksSection<PluginFileDelivery> {
  return {
    delivery,
    released: { relativePath: hooks.flat.sharedFile, format: releasedHooksFormat(hooks) },
  };
}
