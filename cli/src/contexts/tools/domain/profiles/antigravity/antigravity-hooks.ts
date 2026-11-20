import type { ShippedHooks } from "../../../contract/build-contract.js";
import type { ProjectHooksFormat } from "../../../contract/tool-vocabulary.js";
import {
  isWrappedCommandHooksFileEmpty,
  mergeWrappedCommandHooks,
  unmergeWrappedCommandHooks,
  type WrappedCommandHooksTarget,
  wrappedCommandHookEntries,
  wrappedCommandHooksScriptDir,
  wrappedCommandHooksScriptPath,
} from "../../hooks/wrapped-command-hooks-merge.js";
import { ANTIGRAVITY_HOOKS } from "./hooks.js";

const TARGET: WrappedCommandHooksTarget = { label: "Antigravity", descriptor: ANTIGRAVITY_HOOKS };

export function mergeAntigravityHooks(
  existingJson: string | null,
  shipped: ShippedHooks
): { content: string; warnings: readonly string[] } {
  return mergeWrappedCommandHooks(TARGET, existingJson, shipped);
}

/** How `agy`'s `.agents/hooks.json` holds a plugin's entries. */
export function antigravityHooksFormat(): ProjectHooksFormat {
  return {
    merge: (existing, json, plugin) => mergeAntigravityHooks(existing, { json, plugin }),
    unmerge: unmergeWrappedCommandHooks,
    contributedEntries: (content, name) => wrappedCommandHookEntries(TARGET, content, name),
    isEmpty: isWrappedCommandHooksFileEmpty,
    scriptPath: (name, rel) => wrappedCommandHooksScriptPath(TARGET, name, rel),
    scriptDir: (name) => wrappedCommandHooksScriptDir(TARGET, name),
  };
}
