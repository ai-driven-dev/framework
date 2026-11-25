import type { ShippedHooks } from "../../../../shared/domain/materialization/build-contract.js";
import { genericFlatHooksScriptPath } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import type { ProjectHookEntry } from "../../contract/tool-vocabulary.js";
import { toBase64 } from "../formats/base64.js";
import { PLUGIN_HOOKS_SOURCE } from "../formats/hooks/descriptor.js";
import { unmappedEventWarning } from "./hooks-warnings.js";

// The host runs a handler from its own directory under the project and requires JSON stdout even
// for a silent hook.
const JSON_RESPONSE =
  "const p=require('node:child_process').spawn(Buffer.from(process.argv[1],'base64').toString(),{shell:true,cwd:'..',stdio:['inherit','pipe','inherit']});" +
  "let empty=true;p.stdout.on('data',d=>{empty=false;process.stdout.write(d)});" +
  "p.on('close',c=>{if(empty)process.stdout.write('{}');process.exitCode=c??1});";

type HandlerGroup = { matcher: string; hooks: ProjectHookEntry[] };
const isGroup = (entry: ProjectHookEntry | HandlerGroup): entry is HandlerGroup => "hooks" in entry;
type NamedHook = {
  enabled?: boolean;
  [key: string]: (ProjectHookEntry | HandlerGroup)[] | boolean | undefined;
};
type NamedHooks = Record<string, NamedHook>;
type SourceHooks = { hooks?: Record<string, { hooks?: ProjectHookEntry[] }[]> };

/** What a host that keeps hooks as a named, wrapped command is declared by. `label` names the host
 * in an error. */
export interface WrappedCommandHooksTarget {
  readonly label: string;
  readonly descriptor: {
    readonly flat: { readonly scriptsDir: string };
    readonly eventMap: Readonly<Record<string, string>>;
  };
}

export function wrappedCommandHooksScriptPath(
  target: WrappedCommandHooksTarget,
  pluginName: string,
  hooksRelativePath: string
): string {
  const prefix = `${PLUGIN_HOOKS_SOURCE.scriptDir}/`;
  const rest = hooksRelativePath.startsWith(prefix)
    ? hooksRelativePath.slice(prefix.length)
    : hooksRelativePath;
  return genericFlatHooksScriptPath(target.descriptor.flat.scriptsDir, pluginName, rest);
}

function toHandler(hook: ProjectHookEntry): ProjectHookEntry {
  return {
    type: "command",
    command: `node -e "${JSON_RESPONSE}" ${toBase64(hook.command)}`,
    timeout: hook.timeout,
  };
}

function convert(
  target: WrappedCommandHooksTarget,
  { json, plugin: pluginName, locate = (pluginPath) => pluginPath }: ShippedHooks
): { handlers: Record<string, (ProjectHookEntry | HandlerGroup)[]>; warnings: string[] } {
  const parsed = JSON.parse(json) as unknown;
  const rewritten = rewritePluginRootInJson(parsed, (suffix) =>
    suffix.startsWith(`${PLUGIN_HOOKS_SOURCE.scriptDir}/`)
      ? `./${wrappedCommandHooksScriptPath(target, pluginName, suffix)}`
      : `./${locate(suffix)}`
  ) as SourceHooks;
  const handlers: Record<string, (ProjectHookEntry | HandlerGroup)[]> = {};
  const warnings: string[] = [];
  for (const [event, groups] of Object.entries(rewritten.hooks ?? {})) {
    if (!Object.hasOwn(target.descriptor.eventMap, event)) {
      warnings.push(unmappedEventWarning(event));
      continue;
    }
    const converted = groups.flatMap((group) => (group.hooks ?? []).map(toHandler));
    // PostToolUse goes in `{ matcher, hooks: [handler] }`; the other events take bare handlers.
    handlers[event] = event === "PostToolUse" ? [{ matcher: "*", hooks: converted }] : converted;
  }
  return { handlers, warnings };
}

function withoutPlugin(existingJson: string, pluginName: string): NamedHooks {
  const { [pluginName]: _removed, ...kept } = JSON.parse(existingJson) as NamedHooks;
  return kept;
}

function serialize(hooks: NamedHooks): string {
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
    existingJson === null ? {} : (JSON.parse(existingJson) as NamedHooks);
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

export function unmergeWrappedCommandHooks(existingJson: string, pluginName: string): string {
  return serialize(withoutPlugin(existingJson, pluginName));
}

export function wrappedCommandHookEntries(
  target: WrappedCommandHooksTarget,
  content: string,
  pluginName: string
): readonly { event: string; entry: ProjectHookEntry }[] {
  const { enabled: _enabled, ...events } = (JSON.parse(content) as NamedHooks)[pluginName] ?? {};
  return Object.entries(events).flatMap(([event, entries]) => {
    if (!Array.isArray(entries)) {
      throw new Error(`${target.label} hook '${pluginName}.${event}' must be an array.`);
    }
    return entries.flatMap((entry) =>
      (isGroup(entry) ? entry.hooks : [entry]).map((handler) => ({ event, entry: handler }))
    );
  });
}

export function isWrappedCommandHooksFileEmpty(content: string): boolean {
  return Object.keys(JSON.parse(content) as NamedHooks).length === 0;
}

export function wrappedCommandHooksScriptDir(
  target: WrappedCommandHooksTarget,
  pluginName: string
): string {
  return `${target.descriptor.flat.scriptsDir}${pluginName}/`;
}
