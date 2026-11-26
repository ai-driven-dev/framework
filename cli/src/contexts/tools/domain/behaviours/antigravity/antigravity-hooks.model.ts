import type { ShippedHooks } from "../../../../../shared/domain/materialization/build-contract.js";
import type { ProjectHooksFormat } from "../../../contract/tool-vocabulary.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import {
  type WrappedCommandHooksTarget,
  wrappedCommandHooksScriptPath,
} from "../../hooks/wrapped-command-hooks-convert.js";
import {
  isWrappedCommandHooksFileEmpty,
  mergeWrappedCommandHooks,
  unmergeWrappedCommandHooks,
  wrappedCommandHookEntries,
  wrappedCommandHooksScriptDir,
} from "../../hooks/wrapped-command-hooks-merge.js";

export type AntigravityHooks = HooksRouting & {
  readonly flat: FlatHooksRoute;
  readonly eventMap: WrappedCommandHooksTarget["descriptor"]["eventMap"];
  readonly toolNames: WrappedCommandHooksTarget["descriptor"]["toolNames"];
};

function targetOf(hooks: AntigravityHooks): WrappedCommandHooksTarget {
  // `agy` takes context from a PreInvocation hook, not from a PostToolUse one.
  return {
    label: "Antigravity",
    descriptor: { ...hooks, releasesPostToolAnswersAt: "PreInvocation" },
  };
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
    merge: (existing, shipped) => mergeAntigravityHooks(hooks, existing, shipped),
    unmerge: unmergeWrappedCommandHooks,
    contributedEntries: (content, name) => wrappedCommandHookEntries(target, content, name),
    isEmpty: isWrappedCommandHooksFileEmpty,
    scriptPath: (name, rel) => wrappedCommandHooksScriptPath(target, name, rel),
    scriptDir: (name) => wrappedCommandHooksScriptDir(target, name),
  };
}
