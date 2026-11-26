import type { ShippedHooks } from "../../../../shared/domain/materialization/build-contract.js";
import { genericFlatHooksScriptPath } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import { HOST_ADAPTER_PATH } from "../../../../shared/domain/plugin/canon-paths.js";
import type { ProjectHookEntry } from "../../contract/tool-vocabulary.js";
import { toBase64 } from "../formats/base64.js";
import { PLUGIN_HOOKS_SOURCE } from "../formats/hooks/descriptor.js";
import { hostToolNamesMatching, matcherNamesNoToolWarning } from "../formats/host-tool-names.js";
import { unmappedEventWarning } from "./hooks-warnings.js";
import type { PluginHookItem, PluginHooksShape } from "./plugin-hooks-shape.js";

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
  /** The host's event at which a PostToolUse answer can reach the model, when it takes none at
   * PostToolUse itself: a plugin with a PostToolUse handler and the host adapter gets a handler
   * there that releases it. */
  readonly releasesPostToolAnswersAt?: string;
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

/** The way up from where a handler runs to the project root. */
function projectRootOf(target: WrappedCommandHooksTarget): string {
  return target.runsFrom?.projectRoot ?? "..";
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

/** Seconds the handler that releases a held answer may run: it only reads one small file. */
const RELEASE_TIMEOUT = 5;

/** A plugin that holds a PostToolUse answer through the host adapter gets the handler that releases
 * it at the host's own event: the plugin's copy of the adapter, run as that hook's command. */
function addReleaseHandler(
  target: WrappedCommandHooksTarget,
  { plugin: pluginName, locate = (pluginPath) => pluginPath, hostAdapter }: ShippedHooks,
  handlers: Record<string, (ProjectHookEntry | HandlerGroup)[]>
): void {
  const releaseEvent = target.releasesPostToolAnswersAt;
  if (!hostAdapter || releaseEvent === undefined || handlers.PostToolUse === undefined) return;
  const adapter = scriptPathOf(target, { pluginName, suffix: HOST_ADAPTER_PATH, locate });
  const command = `node ./${adapter}`;
  handlers[releaseEvent] = [
    toHandler(releaseEvent, projectRootOf(target))({ command, timeout: RELEASE_TIMEOUT }),
  ];
}

export function convert(
  target: WrappedCommandHooksTarget,
  shipped: ShippedHooks
): { handlers: Record<string, (ProjectHookEntry | HandlerGroup)[]>; warnings: string[] } {
  const { json, plugin: pluginName, locate = (pluginPath) => pluginPath } = shipped;
  const parsed = JSON.parse(json) as unknown;
  const projectRoot = projectRootOf(target);
  const rewritten = rewritePluginRootInJson(
    parsed,
    (suffix) => `./${scriptPathOf(target, { pluginName, suffix, locate })}`
  ) as PluginHooksShape;
  const handlers: Record<string, (ProjectHookEntry | HandlerGroup)[]> = {};
  const warnings: string[] = [];
  for (const [event, groups] of Object.entries(rewritten.hooks ?? {})) {
    if (!Object.hasOwn(target.descriptor.eventMap, event)) {
      warnings.push(unmappedEventWarning(event));
      continue;
    }
    if (!TOOL_EVENTS.has(event)) {
      handlers[event] = groups.flatMap((group) =>
        (group.hooks ?? []).filter(runsCommand).map(toHandler(event, projectRoot))
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
      return [
        {
          matcher,
          hooks: (group.hooks ?? []).filter(runsCommand).map(toHandler(event, projectRoot)),
        },
      ];
    });
    if (grouped.length > 0) handlers[event] = grouped;
  }
  addReleaseHandler(target, shipped, handlers);
  return { handlers, warnings };
}
