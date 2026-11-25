import type { ShippedHooks } from "../../../../shared/domain/materialization/build-contract.js";
import { genericFlatHooksScriptPath } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import type { ProjectHookEntry } from "../../contract/tool-vocabulary.js";
import { toBase64 } from "../formats/base64.js";
import { PLUGIN_HOOKS_SOURCE } from "../formats/hooks/descriptor.js";
import { hostToolNamesMatching, matcherNamesNoToolWarning } from "../formats/host-tool-names.js";
import type { PluginHookItem, PluginHooksShape } from "./plugin-hooks-shape.js";

// The host runs a handler from its own directory under the project and requires JSON stdout even
// for a silent hook. Before a tool, `{}` is a deny: a silent script lets the tool run by saying so.
// `silent` is a JS expression: the program sits inside a double-quoted shell argument.
const jsonResponse = (silent: string) =>
  "const p=require('node:child_process').spawn(Buffer.from(process.argv[1],'base64').toString(),{shell:true,cwd:'..',stdio:['inherit','pipe','inherit']});" +
  "let empty=true;p.stdout.on('data',d=>{empty=false;process.stdout.write(d)});" +
  `p.on('close',c=>{if(empty)process.stdout.write(${silent});process.exitCode=c??1});`;

/** The events whose handlers are grouped under the tools they run for. */
const TOOL_EVENTS: ReadonlySet<string> = new Set(["PreToolUse", "PostToolUse"]);

type HandlerGroup = { matcher: string; hooks: ProjectHookEntry[] };
const isGroup = (entry: ProjectHookEntry | HandlerGroup): entry is HandlerGroup => "hooks" in entry;
type NamedHook = {
  enabled?: boolean;
  [key: string]: (ProjectHookEntry | HandlerGroup)[] | boolean | undefined;
};
type NamedHooks = Record<string, NamedHook>;

/** What a host that keeps hooks as a named, wrapped command is declared by. `label` names the host
 * in an error. */
export interface WrappedCommandHooksTarget {
  readonly label: string;
  readonly descriptor: {
    readonly flat: { readonly scriptsDir: string };
    readonly eventMap: Readonly<Record<string, string>>;
    /** The host's name of each tool a plugin's matcher names, by the name the plugin gives it. */
    readonly toolNames: ReadonlyMap<string, string>;
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

const runsCommand = (hook: PluginHookItem): hook is PluginHookItem & ProjectHookEntry =>
  typeof hook.command === "string";

const toHandler =
  (event: string) =>
  (hook: ProjectHookEntry): ProjectHookEntry => ({
    type: "command",
    command: `node -e "${jsonResponse(event === "PreToolUse" ? "JSON.stringify({decision:'allow'})" : "'{}'")}" ${toBase64(hook.command)}`,
    timeout: hook.timeout,
  });

/** The matcher in the host's tool names, or undefined when it selects no tool the host has. A plugin
 * with no matcher asks for every tool. */
function hostMatcher(target: WrappedCommandHooksTarget, matcher: string | undefined) {
  if (matcher === undefined) return "*";
  const names = hostToolNamesMatching(matcher, target.descriptor.toolNames);
  return names.length > 0 ? names.join("|") : undefined;
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
  ) as PluginHooksShape;
  const handlers: Record<string, (ProjectHookEntry | HandlerGroup)[]> = {};
  const warnings: string[] = [];
  for (const [event, groups] of Object.entries(rewritten.hooks ?? {})) {
    if (!Object.hasOwn(target.descriptor.eventMap, event)) {
      warnings.push(`unmapped event '${event}' skipped`);
      continue;
    }
    if (!TOOL_EVENTS.has(event)) {
      handlers[event] = groups.flatMap((group) =>
        (group.hooks ?? []).filter(runsCommand).map(toHandler(event))
      );
      continue;
    }
    // A tool event goes in `{ matcher, hooks: [handler] }`, one group per group the plugin wrote.
    const grouped = groups.flatMap((group) => {
      const matcher = hostMatcher(target, group.matcher);
      if (matcher === undefined) {
        warnings.push(matcherNamesNoToolWarning(target.label, event, group.matcher ?? ""));
        return [];
      }
      return [{ matcher, hooks: (group.hooks ?? []).filter(runsCommand).map(toHandler(event)) }];
    });
    if (grouped.length > 0) handlers[event] = grouped;
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
