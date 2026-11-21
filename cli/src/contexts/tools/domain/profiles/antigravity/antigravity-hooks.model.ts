import type { ShippedHooks } from "../../../contract/build-contract.js";
import type { ProjectHooksFormat } from "../../../contract/tool-vocabulary.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import {
  isWrappedCommandHooksFileEmpty,
  mergeWrappedCommandHooks,
  unmergeWrappedCommandHooks,
  type WrappedCommandHooksTarget,
  wrappedCommandHookEntries,
  wrappedCommandHooksScriptDir,
  wrappedCommandHooksScriptPath,
} from "../../hooks/wrapped-command-hooks-merge.js";

export type AntigravityHooks = HooksRouting & {
  readonly flat: FlatHooksRoute;
  readonly eventMap: WrappedCommandHooksTarget["descriptor"]["eventMap"];
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

/** How `agy`'s `.agents/hooks.json` holds a plugin's entries. */
export function antigravityHooksFormat(hooks: AntigravityHooks): ProjectHooksFormat {
  const target = targetOf(hooks);
  return {
    merge: (existing, json, plugin) => mergeAntigravityHooks(hooks, existing, { json, plugin }),
    unmerge: unmergeWrappedCommandHooks,
    contributedEntries: (content, name) => wrappedCommandHookEntries(target, content, name),
    isEmpty: isWrappedCommandHooksFileEmpty,
    scriptPath: (name, rel) => wrappedCommandHooksScriptPath(target, name, rel),
    scriptDir: (name) => wrappedCommandHooksScriptDir(target, name),
  };
}
