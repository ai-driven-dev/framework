import type { ShippedHooks } from "../../../../shared/domain/materialization/build-contract.js";
import { genericFlatHooksScriptPath } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import type { ProjectHookEntry } from "../../contract/tool-vocabulary.js";
import { toBase64 } from "../formats/base64.js";
import { PLUGIN_HOOKS_SOURCE } from "../formats/hooks/descriptor.js";
import { hostToolNamesMatching, matcherNamesNoToolWarning } from "../formats/host-tool-names.js";
import { routeEvents } from "./hooks-route.js";
import { unmappedEventWarning } from "./hooks-warnings.js";
import type { PluginHookItem, PluginHooksShape, PluginMatcherGroup } from "./plugin-hooks-shape.js";

// The host runs a handler from its own directory under the project and requires JSON stdout even
// for a silent hook. Before a tool, `{}` is a deny: a silent script lets the tool run by saying so.
// `silent` is a JS expression: the program sits inside a double-quoted shell argument.
const jsonResponse = (silent: string, projectRoot: string) =>
  `const p=require('node:child_process').spawn(Buffer.from(process.argv[1],'base64').toString(),{shell:true,cwd:'${projectRoot}',stdio:['inherit','pipe','inherit']});` +
  "let empty=true;p.stdout.on('data',d=>{empty=false;process.stdout.write(d)});" +
  `p.on('close',c=>{if(empty)process.stdout.write(${silent});process.exitCode=c??1});`;

/** The events whose handlers are grouped under the tools they run for. */
const TOOL_EVENTS: ReadonlySet<string> = new Set(["PreToolUse", "PostToolUse"]);

export type HandlerGroup = { matcher: string; hooks: ProjectHookEntry[] };
type NamedHook = {
  enabled?: boolean;
  [key: string]: (ProjectHookEntry | HandlerGroup)[] | boolean | undefined;
};
export type NamedHooks = Record<string, NamedHook>;

/** What a host that keeps hooks as a named, wrapped command is declared by. `label` names the host
 * in an error. */
export interface WrappedCommandHooksTarget {
  readonly label: string;
  /** Set for a host that runs a handler from the plugin's own directory: the way up from there to
   * the project root, and the plugin's directory below that root. Absent, the host runs it from
   * the folder holding the route's `scriptsDir`, one level below the root. */
  readonly runsFrom?: {
    readonly projectRoot: string;
    readonly pluginDir: (plugin: string) => string;
  };
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
  (event: string, projectRoot: string) =>
  (hook: ProjectHookEntry): ProjectHookEntry => ({
    type: "command",
    command: `node -e "${jsonResponse(event === "PreToolUse" ? "JSON.stringify({decision:'allow'})" : "'{}'", projectRoot)}" ${toBase64(hook.command)}`,
    timeout: hook.timeout,
  });

/** The matcher in the host's tool names, or undefined when it selects no tool the host has. A plugin
 * with no matcher asks for every tool. */
function hostMatcher(target: WrappedCommandHooksTarget, matcher: string | undefined) {
  if (matcher === undefined) return "*";
  const names = hostToolNamesMatching(matcher, target.descriptor.toolNames);
  return names.length > 0 ? names.join("|") : undefined;
}

/** Where a script a plugin names sits from the project root. */
function scriptPathOf(
  target: WrappedCommandHooksTarget,
  at: { pluginName: string; suffix: string; locate: (pluginPath: string) => string }
): string {
  const { pluginName, suffix, locate } = at;
  if (target.runsFrom !== undefined) return `${target.runsFrom.pluginDir(pluginName)}${suffix}`;
  return suffix.startsWith(`${PLUGIN_HOOKS_SOURCE.scriptDir}/`)
    ? wrappedCommandHooksScriptPath(target, pluginName, suffix)
    : locate(suffix);
}

/** One event's handlers: a tool event goes in `{ matcher, hooks: [handler] }`, one group per group
 * the plugin wrote; any other event holds its handlers flat. */
function handlersOf(
  target: WrappedCommandHooksTarget,
  groups: readonly PluginMatcherGroup[],
  toolEvent: string
): { entries: (ProjectHookEntry | HandlerGroup)[]; warnings: string[] } {
  const handler = toHandler(toolEvent, target.runsFrom?.projectRoot ?? "..");
  if (!TOOL_EVENTS.has(toolEvent)) {
    return {
      entries: groups.flatMap((group) => (group.hooks ?? []).filter(runsCommand).map(handler)),
      warnings: [],
    };
  }
  const warnings: string[] = [];
  const entries = groups.flatMap((group) => {
    const matcher = hostMatcher(target, group.matcher);
    if (matcher === undefined) {
      warnings.push(matcherNamesNoToolWarning(target.label, toolEvent, group.matcher ?? ""));
      return [];
    }
    return [{ matcher, hooks: (group.hooks ?? []).filter(runsCommand).map(handler) }];
  });
  return { entries, warnings };
}

function convert(
  target: WrappedCommandHooksTarget,
  { json, plugin: pluginName, locate = (pluginPath) => pluginPath }: ShippedHooks
): { handlers: Record<string, (ProjectHookEntry | HandlerGroup)[]>; warnings: string[] } {
  const rewritten = rewritePluginRootInJson(
    JSON.parse(json),
    (suffix) => `./${scriptPathOf(target, { pluginName, suffix, locate })}`
  ) as PluginHooksShape;
  const { routed, skipped } = routeEvents(
    Object.entries(rewritten.hooks ?? {}),
    target.descriptor.eventMap,
    (groups, toolEvent) => handlersOf(target, groups, toolEvent)
  );
  const kept = routed.filter(
    ([toolEvent, { entries }]) => !TOOL_EVENTS.has(toolEvent) || entries.length > 0
  );
  return {
    handlers: Object.fromEntries(kept.map(([toolEvent, { entries }]) => [toolEvent, entries])),
    warnings: [
      ...skipped.map(unmappedEventWarning),
      ...routed.flatMap(([, { warnings }]) => warnings),
    ],
  };
}

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
