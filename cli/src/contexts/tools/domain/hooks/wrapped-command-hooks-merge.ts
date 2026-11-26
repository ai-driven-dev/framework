import type { ShippedHooks } from "../../../../shared/domain/materialization/build-contract.js";
import type { ProjectHookEntry } from "../../contract/tool-vocabulary.js";
import {
  convert,
  type HandlerGroup,
  type WrappedCommandHooksTarget,
} from "./wrapped-command-hooks-convert.js";

type NamedHook = {
  enabled?: boolean;
  [key: string]: (ProjectHookEntry | HandlerGroup)[] | boolean | undefined;
};
export type NamedHooks = Record<string, NamedHook>;

export function readNamedHooks(json: string): NamedHooks {
  return JSON.parse(json) as NamedHooks;
}

export function withoutPlugin(existingJson: string, pluginName: string): NamedHooks {
  const { [pluginName]: _removed, ...kept } = readNamedHooks(existingJson);
  return kept;
}

export function serialize(hooks: NamedHooks): string {
  return `${JSON.stringify(hooks, null, 2)}\n`;
}

/** `locate` places a path the plugin ships outside `hooks/`; `plugin install` ships none. */
export function mergeWrappedCommandHooks(
  target: WrappedCommandHooksTarget,
  existingJson: string | null,
  shipped: ShippedHooks
): { content: string; warnings: readonly string[] } {
  const pluginName = shipped.plugin;
  const { [pluginName]: previous, ...kept } =
    existingJson === null ? {} : readNamedHooks(existingJson);
  const { handlers, warnings } = convert(target, shipped);
  const merged =
    Object.keys(handlers).length > 0
      ? {
          ...kept,
          [pluginName]: {
            ...(previous?.enabled === undefined ? {} : { enabled: previous.enabled }),
            ...handlers,
          },
        }
      : kept;
  return { content: serialize(merged), warnings };
}
