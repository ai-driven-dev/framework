/** Kiro's hooks file: a `version` and a flat `hooks` list of named hooks, each a trigger and a
 * command action (https://kiro.dev/docs/hooks/). No `HooksFileFormat` describes that list, so its
 * merge is Kiro's own.
 *
 * Only a command of the form `node ${CLAUDE_PLUGIN_ROOT}/hooks/...` is delivered; any other is
 * dropped, and no plugin ships one. Only `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
 * `PostToolUse`, `Stop` and `SubagentStop` are delivered. A PostToolUse matcher names Claude
 * Code's tools; Kiro selects by a tool's tag (https://kiro.dev/docs/hooks/types/), and a matcher
 * with `|` is a regex there, never a selector, so each tag gets its own hook. PreToolUse takes
 * none: it runs for every tool, and its script tells a write by the files it reads. Stop and
 * UserPromptSubmit take no matcher, SubagentStop's names an agent, never a tool, and SessionStart
 * none a plugin ships. */

import type { ShippedHooks } from "../../../../../shared/domain/materialization/build-contract.js";
import { genericFlatHooksScriptPath } from "../../../../../shared/domain/materialization/flat-paths.js";
import { asPlainObject } from "../../../../../shared/domain/reading/plain-object.js";
import type { ProjectHooksFormat } from "../../../contract/tool-vocabulary.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { hostToolNamesMatching, matcherNamesNoToolWarning } from "../../formats/host-tool-names.js";
import { pluginScriptDir, pluginScriptPath } from "../../hooks/hooks-merge.js";
import { unmappedEventWarning } from "../../hooks/hooks-warnings.js";
import {
  type BridgeHookCall,
  bridgeHookCalls,
  type PluginMatcherGroup,
} from "../../hooks/plugin-hooks-shape.js";

export type KiroHooks = HooksRouting & {
  readonly flat: FlatHooksRoute;
  readonly eventMap: Readonly<Record<string, string>>;
  /** The tag Kiro selects a tool by, for each Claude tool a plugin's matcher can name. */
  readonly toolNames: ReadonlyMap<string, string>;
};

interface KiroHook {
  readonly name: string;
  readonly trigger: string;
  readonly action: { readonly type: string; readonly command?: string };
  readonly matcher?: string;
  readonly timeout?: number;
}

const VERSION = "v1";

/** Kiro names no variable for where a hooks file lives, so a command finds its script itself.
 * The home copy wins: a repository must not have its script run by a hook installed in the home.
 * Exit 0 and exit 2 pass through: 2 is a refusal, its reason on stderr. Any other status, or a
 * signal, is a crash and exits 0, because Kiro continues a Stop turn on exit 1. A deliberate
 * continuation is the block decision printed on stdout. */
function launcher(scriptsDir: string, plugin: string, call: BridgeHookCall): string {
  const relative = genericFlatHooksScriptPath(scriptsDir, plugin, call.script);
  const program = [
    "const p=require('path'),f=require('fs'),os=require('os');",
    `const r=${JSON.stringify(relative).replace(/"/g, "'")};`,
    "const s=[p.join(os.homedir(),r),p.resolve(r)].find(x=>f.existsSync(x));",
    "if(!s){console.error('aidd: hook script not found: '+r);process.exit(0)}",
    "const c=require('child_process').spawnSync(process.execPath,[s,...process.argv.slice(1)],{stdio:'inherit'});",
    "if(c.status===0||c.status===2)process.exit(c.status);",
    "console.error('aidd: hook script failed: '+r);process.exit(0)",
  ].join("");
  return [`node -e "${program}" --`, ...call.args].join(" ");
}

function isHook(value: unknown): value is KiroHook {
  const hook = asPlainObject(value);
  return (
    hook !== null &&
    typeof hook.name === "string" &&
    typeof hook.trigger === "string" &&
    asPlainObject(hook.action) !== null
  );
}

function fileOf(content: string | null): Record<string, unknown> {
  return content === null ? {} : (asPlainObject(JSON.parse(content)) ?? {});
}

function hooksOf(content: string | null): readonly KiroHook[] {
  const { hooks } = fileOf(content);
  return Array.isArray(hooks) ? hooks.filter(isHook) : [];
}

/** The file with its hooks replaced; every other key a person wrote stays. */
function serialize(existing: string | null, hooks: readonly KiroHook[]): string {
  return `${JSON.stringify({ version: VERSION, ...fileOf(existing), hooks }, null, 2)}\n`;
}

function isGroup(value: unknown): value is PluginMatcherGroup {
  const group = asPlainObject(value);
  return group !== null && Array.isArray(group.hooks);
}

/** A plugin's shipped hooks by event; an event whose groups are not groups of hooks is none. */
function shippedEvents(json: string): [string, PluginMatcherGroup[]][] {
  const { hooks } = asPlainObject(JSON.parse(json)) ?? {};
  return Object.entries(asPlainObject(hooks) ?? {}).flatMap(([event, groups]) =>
    Array.isArray(groups) && groups.every(isGroup) ? [[event, groups]] : []
  );
}

/** A hook is a plugin's when its command names that plugin's own scripts folder. */
function runs(hooks: KiroHooks, hook: KiroHook, plugin: string): boolean {
  return (
    hook.action.command?.includes(`'${pluginScriptDir(hooks.flat.scriptsDir, plugin)}`) === true
  );
}

interface Built {
  readonly hooks: readonly KiroHook[];
  readonly warnings: readonly string[];
}

interface Where {
  readonly scriptsDir: string;
  readonly plugin: string;
  readonly trigger: string;
  readonly toolNames: ReadonlyMap<string, string>;
}

/** One hook per tag of the call's matcher, or one selecting every tool when it has none. Kiro keys
 * a hook by its place in the file (`<file>#hook-<index>`, seen on kiro-cli 3.6.0), so a name only has to read well: each trigger and tag of a
 * script gets its own. Ownership is matched by command, not name. */
function hooksOfCall(
  { scriptsDir, plugin, trigger, toolNames }: Where,
  call: BridgeHookCall,
  timeout: unknown
): Built {
  const selectors =
    call.matcher === undefined ? [undefined] : hostToolNamesMatching(call.matcher, toolNames);
  const warnings =
    selectors.length === 0 ? [matcherNamesNoToolWarning("Kiro", trigger, call.matcher ?? "")] : [];
  const hooks = selectors.map((selector) => ({
    name: [plugin, trigger, call.script, selector].filter(Boolean).join("-"),
    trigger,
    ...(selector === undefined ? {} : { matcher: selector }),
    action: { type: "command", command: launcher(scriptsDir, plugin, call) },
    ...(typeof timeout === "number" ? { timeout } : {}),
  }));
  return { hooks, warnings };
}

function hooksOfEvent(where: Where, groups: readonly PluginMatcherGroup[]): Built {
  const built = groups.flatMap((group) =>
    (group.hooks ?? []).flatMap((item) =>
      // Only PostToolUse selects by tool: no other trigger a plugin ships takes a tool matcher.
      bridgeHookCalls([
        { matcher: where.trigger === "PostToolUse" ? group.matcher : undefined, hooks: [item] },
      ]).map((call) => hooksOfCall(where, call, item.timeout))
    )
  );
  return {
    hooks: built.flatMap((one) => one.hooks),
    warnings: built.flatMap((one) => one.warnings),
  };
}

export function mergeKiroHooks(
  hooks: KiroHooks,
  existingJson: string | null,
  shipped: ShippedHooks
): { content: string; warnings: readonly string[] } {
  const kept = hooksOf(existingJson).filter((hook) => !runs(hooks, hook, shipped.plugin));
  const added: KiroHook[] = [];
  const warnings: string[] = [];
  for (const [event, groups] of shippedEvents(shipped.json)) {
    const trigger = Object.hasOwn(hooks.eventMap, event) ? hooks.eventMap[event] : undefined;
    if (trigger === undefined) {
      warnings.push(unmappedEventWarning(event));
      continue;
    }
    const built = hooksOfEvent(
      {
        scriptsDir: hooks.flat.scriptsDir,
        plugin: shipped.plugin,
        trigger,
        toolNames: hooks.toolNames,
      },
      groups
    );
    added.push(...built.hooks);
    warnings.push(...built.warnings);
  }
  return { content: serialize(existingJson, [...kept, ...added]), warnings };
}

/** How Kiro's `.kiro/hooks/aidd.json` holds a plugin's entries. */
export function kiroHooksFormat(hooks: KiroHooks): ProjectHooksFormat {
  const scripts = hooks.flat.scriptsDir;
  return {
    merge: (existing, shipped) => mergeKiroHooks(hooks, existing, shipped),
    unmerge: (existing, plugin) =>
      serialize(
        existing,
        hooksOf(existing).filter((hook) => !runs(hooks, hook, plugin))
      ),
    contributedEntries: (content, plugin) =>
      hooksOf(content)
        .filter((hook) => runs(hooks, hook, plugin))
        .map(({ name, trigger, matcher, action, timeout }) => ({
          event: trigger,
          entry: {
            name,
            command: action.command ?? "",
            ...(matcher === undefined ? {} : { matcher }),
            ...(timeout === undefined ? {} : { timeout }),
          },
        })),
    isEmpty: (content) => hooksOf(content).length === 0,
    scriptPath: (plugin, relativePath) => pluginScriptPath(scripts, plugin, relativePath),
    scriptDir: (plugin) => pluginScriptDir(scripts, plugin),
  };
}
