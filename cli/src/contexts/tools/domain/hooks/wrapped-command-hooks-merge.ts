import { genericFlatHooksScriptPath } from "../../../../kernel/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../kernel/materialization/plugin-root-path-rewrite.js";
import type { ProjectHookEntry } from "../../contract/tool-vocabulary.js";
import { toBase64 } from "../formats/base64.js";
import { PLUGIN_HOOKS_SOURCE } from "../formats/hooks-descriptor.js";

// The host runs a handler from its own directory under the project and requires JSON stdout even
// for a silent hook.
const JSON_RESPONSE =
  "const p=require('node:child_process').spawn(Buffer.from(process.argv[1],'base64').toString(),{shell:true,cwd:'..',stdio:['inherit','pipe','inherit']});" +
  "let empty=true;p.stdout.on('data',d=>{empty=false;process.stdout.write(d)});" +
  "p.on('close',c=>{if(empty)process.stdout.write('{}');process.exitCode=c??1});";

type NamedHook = {
  enabled?: boolean;
  [key: string]: ProjectHookEntry[] | boolean | undefined;
};
type NamedHooks = Record<string, NamedHook>;
type SourceHooks = { hooks?: Record<string, { hooks?: ProjectHookEntry[] }[]> };

/** What a host that keeps hooks as a named, wrapped command is declared by. `label` names the host
 * in an error. */
export interface WrappedCommandHooksTarget {
  readonly label: string;
  readonly descriptor: {
    readonly flat: { readonly scriptsDir: string };
    readonly eventMap: Readonly<Record<string, readonly string[]>>;
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
  const handler: ProjectHookEntry = {
    type: "command",
    command: `node -e "${JSON_RESPONSE}" ${toBase64(hook.command)}`,
  };
  if (hook.timeout !== undefined) handler.timeout = hook.timeout;
  return handler;
}

function convert(
  target: WrappedCommandHooksTarget,
  pluginHooksJson: string,
  pluginName: string,
  locate: (pluginPath: string) => string
): { handlers: Record<string, ProjectHookEntry[]>; warnings: string[] } {
  const parsed = JSON.parse(pluginHooksJson) as unknown;
  const rewritten = rewritePluginRootInJson(parsed, (suffix) =>
    suffix.startsWith(`${PLUGIN_HOOKS_SOURCE.scriptDir}/`)
      ? `./${wrappedCommandHooksScriptPath(target, pluginName, suffix)}`
      : `./${locate(suffix)}`
  ) as SourceHooks;
  const handlers: Record<string, ProjectHookEntry[]> = {};
  const warnings: string[] = [];
  for (const [event, groups] of Object.entries(rewritten.hooks ?? {})) {
    if (!Object.hasOwn(target.descriptor.eventMap, event)) {
      warnings.push(`unmapped event '${event}' skipped`);
      continue;
    }
    handlers[event] = groups.flatMap((group) => (group.hooks ?? []).map(toHandler));
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
  pluginHooksJson: string,
  pluginName: string,
  locate: (pluginPath: string) => string = (pluginPath) => pluginPath
): { content: string; warnings: readonly string[] } {
  const { [pluginName]: previous, ...kept } =
    existingJson === null ? {} : (JSON.parse(existingJson) as NamedHooks);
  const { handlers, warnings } = convert(target, pluginHooksJson, pluginName, locate);
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
    return entries.map((entry) => ({ event, entry }));
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
