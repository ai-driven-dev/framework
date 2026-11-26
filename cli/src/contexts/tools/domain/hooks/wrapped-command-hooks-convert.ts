import type { ShippedHooks } from "../../../../shared/domain/materialization/build-contract.js";
import { genericFlatHooksScriptPath } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import type { ProjectHookEntry } from "../../contract/tool-vocabulary.js";
import { toBase64 } from "../formats/base64.js";
import { PLUGIN_HOOKS_SOURCE } from "../formats/hooks/descriptor.js";
import { HOST_ADAPTER_PATH } from "../formats/hooks/routes.js";
import { hostToolNamesMatching, matcherNamesNoToolWarning } from "../formats/host-tool-names.js";
import { unmappedEventWarning } from "./hooks-warnings.js";
import type { PluginHookItem, PluginHooksShape, PluginMatcherGroup } from "./plugin-hooks-shape.js";

// The host runs a handler from its own directory under the project and requires JSON stdout even
// for a silent hook. Before a tool, `{}` is a deny: a silent script lets the tool run by saying so.
// `silent` is a JS expression: the program sits inside a double-quoted shell argument.
const jsonResponse = (silent: string) =>
  "const p=require('node:child_process').spawn(Buffer.from(process.argv[1],'base64').toString(),{shell:true,cwd:'..',stdio:['inherit','pipe','inherit']});" +
  "let empty=true;p.stdout.on('data',d=>{empty=false;process.stdout.write(d)});" +
  `p.on('close',c=>{if(empty)process.stdout.write(${silent});process.exitCode=c??1});`;

/** The events whose handlers are grouped under the tools they run for. */
const TOOL_EVENTS: ReadonlySet<string> = new Set(["PreToolUse", "PostToolUse"]);

export type HandlerGroup = { matcher: string; hooks: ProjectHookEntry[] };
type Handlers = Record<string, (ProjectHookEntry | HandlerGroup)[]>;

/** What a host that keeps hooks as a named, wrapped command is declared by. `label` names the host
 * in an error. */
export interface WrappedCommandHooksTarget {
  readonly label: string;
  readonly descriptor: {
    readonly flat: { readonly scriptsDir: string };
    readonly eventMap: Readonly<Record<string, string>>;
    /** The host's name of each tool a plugin's matcher names, by the name the plugin gives it. */
    readonly toolNames: ReadonlyMap<string, string>;
    /** The host's event at which a PostToolUse answer can reach the model, when it takes none at
     * PostToolUse itself: a plugin with a PostToolUse handler gets one there that releases it. */
    readonly releasesPostToolAnswersAt?: string;
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

/** A tool event goes in `{ matcher, hooks: [handler] }`, one group per group the plugin wrote; a
 * group naming no tool the host has is skipped, and said so. */
function groupedHandlers(
  target: WrappedCommandHooksTarget,
  event: string,
  groups: readonly PluginMatcherGroup[]
): { grouped: HandlerGroup[]; warnings: string[] } {
  const warnings: string[] = [];
  const grouped = groups.flatMap((group) => {
    const matcher = hostMatcher(target, group.matcher);
    if (matcher === undefined) {
      warnings.push(matcherNamesNoToolWarning(target.label, event, group.matcher ?? ""));
      return [];
    }
    return [{ matcher, hooks: (group.hooks ?? []).filter(runsCommand).map(toHandler(event)) }];
  });
  return { grouped, warnings };
}

/** One event's handlers, or none when the host does not map the event or no group of it survives. */
function eventHandlers(
  target: WrappedCommandHooksTarget,
  event: string,
  groups: readonly PluginMatcherGroup[]
): { handlers?: Handlers[string]; warnings: string[] } {
  if (!Object.hasOwn(target.descriptor.eventMap, event)) {
    return { warnings: [unmappedEventWarning(event)] };
  }
  if (!TOOL_EVENTS.has(event)) {
    const flat = groups.flatMap((group) =>
      (group.hooks ?? []).filter(runsCommand).map(toHandler(event))
    );
    return { handlers: flat, warnings: [] };
  }
  const { grouped, warnings } = groupedHandlers(target, event, groups);
  return { ...(grouped.length > 0 ? { handlers: grouped } : {}), warnings };
}

/** The handler that releases a PostToolUse answer at the host's own event: the plugin's copy of the
 * host adapter, run as that hook's command. */
function releaseHandler(
  target: WrappedCommandHooksTarget,
  pluginName: string,
  event: string
): ProjectHookEntry {
  const adapter = wrappedCommandHooksScriptPath(target, pluginName, HOST_ADAPTER_PATH);
  return toHandler(event)({ command: `node ./${adapter}` });
}

export function convert(
  target: WrappedCommandHooksTarget,
  { json, plugin: pluginName, locate = (pluginPath) => pluginPath }: ShippedHooks
): { handlers: Handlers; warnings: string[] } {
  const parsed = JSON.parse(json) as unknown;
  const rewritten = rewritePluginRootInJson(parsed, (suffix) =>
    suffix.startsWith(`${PLUGIN_HOOKS_SOURCE.scriptDir}/`)
      ? `./${wrappedCommandHooksScriptPath(target, pluginName, suffix)}`
      : `./${locate(suffix)}`
  ) as PluginHooksShape;
  const handlers: Handlers = {};
  const warnings: string[] = [];
  for (const [event, groups] of Object.entries(rewritten.hooks ?? {})) {
    const converted = eventHandlers(target, event, groups);
    warnings.push(...converted.warnings);
    if (converted.handlers !== undefined) handlers[event] = converted.handlers;
  }
  const { releasesPostToolAnswersAt: releaseEvent } = target.descriptor;
  if (releaseEvent !== undefined && handlers.PostToolUse !== undefined) {
    handlers[releaseEvent] = [releaseHandler(target, pluginName, releaseEvent)];
  }
  return { handlers, warnings };
}
