/** Kiro's hooks file: a version and a flat list of named hooks, each a trigger and a command.
 * No `HooksFileFormat` describes that list, so its merge is the profile's own. */

import { genericFlatHooksScriptPath } from "../../../../../kernel/materialization/flat-paths.js";
import type { ProjectHookEntry } from "../../capabilities/plugins-capability.js";
import { pluginScriptDir, pluginScriptPath } from "../../formats/hooks-merge.js";
import {
  type BridgeHookCall,
  bridgeHookCalls,
  type PluginHookItem,
  type PluginHooksShape,
} from "../../formats/plugin-hooks-shape.js";
import { KIRO_HOOKS } from "./hooks.js";

interface KiroHook {
  readonly name: string;
  readonly trigger: string;
  readonly action: { readonly type: string; readonly command?: string };
  readonly timeout?: number;
}

const VERSION = "v1";
const MAPPED: Readonly<Record<string, readonly string[]>> = KIRO_HOOKS.eventMap;
const SCRIPTS = KIRO_HOOKS.flat.scriptsDir;

/** Kiro names no variable for where a hooks file lives, so a command finds its script itself.
 * The home copy wins: a repository must not have its script run by a hook installed in the home. */
function launcher(plugin: string, call: BridgeHookCall): string {
  const relative = genericFlatHooksScriptPath(SCRIPTS, plugin, call.script);
  const program = [
    "const p=require('path'),f=require('fs'),os=require('os');",
    `const r=${JSON.stringify(relative).replace(/"/g, "'")};`,
    "const s=[p.join(os.homedir(),r),p.resolve(r)].find(x=>f.existsSync(x));",
    "if(!s){console.error('aidd: hook script not found: '+r);process.exit(0)}",
    "const c=require('child_process').spawnSync(process.execPath,[s,...process.argv.slice(1)],{stdio:'inherit'});",
    "process.exit(c.status===null?1:c.status)",
  ].join("");
  return [`node -e "${program}" --`, ...call.args].join(" ");
}

/** A hook is a plugin's when its command names that plugin's own scripts folder. */
function runs(hook: KiroHook, plugin: string): boolean {
  return hook.action.command?.includes(`'${pluginScriptDir(SCRIPTS, plugin)}`) === true;
}

function toKiroHooks(plugin: string, trigger: string, item: PluginHookItem): KiroHook[] {
  return bridgeHookCalls([{ hooks: [item] }]).map((call) => ({
    name: `${plugin}-${call.script}`,
    trigger,
    action: { type: "command", command: launcher(plugin, call) },
    ...(typeof item.timeout === "number" ? { timeout: item.timeout } : {}),
  }));
}

function hooksOf(content: string | null): readonly KiroHook[] {
  if (content === null) return [];
  return (JSON.parse(content) as { hooks?: readonly KiroHook[] }).hooks ?? [];
}

function serialize(hooks: readonly KiroHook[]): string {
  return `${JSON.stringify({ version: VERSION, hooks }, null, 2)}\n`;
}

export function mergeKiroHooks(
  existingJson: string | null,
  pluginHooksJson: string,
  pluginName: string
): { content: string; warnings: readonly string[] } {
  const kept = hooksOf(existingJson).filter((hook) => !runs(hook, pluginName));
  const shipped = (JSON.parse(pluginHooksJson) as PluginHooksShape).hooks ?? {};
  const added: KiroHook[] = [];
  const warnings: string[] = [];
  for (const [event, groups] of Object.entries(shipped)) {
    const triggers = Object.hasOwn(MAPPED, event) ? MAPPED[event] : undefined;
    if (triggers === undefined) {
      warnings.push(`unmapped event '${event}' skipped`);
      continue;
    }
    const items = groups.flatMap((group) => group.hooks ?? []);
    for (const trigger of triggers) {
      added.push(...items.flatMap((item) => toKiroHooks(pluginName, trigger, item)));
    }
  }
  return { content: serialize([...kept, ...added]), warnings };
}

export function unmergeKiroHooks(existingJson: string, pluginName: string): string {
  return serialize(hooksOf(existingJson).filter((hook) => !runs(hook, pluginName)));
}

export function kiroHookEntries(
  content: string,
  pluginName: string
): readonly { event: string; entry: ProjectHookEntry }[] {
  return hooksOf(content)
    .filter((hook) => runs(hook, pluginName))
    .map(({ name, trigger, action, timeout }) => ({
      event: trigger,
      entry: {
        name,
        command: action.command ?? "",
        ...(timeout === undefined ? {} : { timeout }),
      },
    }));
}

export function isKiroHooksFileEmpty(content: string): boolean {
  return hooksOf(content).length === 0;
}

export function kiroHooksScriptPath(pluginName: string, hooksRelativePath: string): string {
  return pluginScriptPath(SCRIPTS, pluginName, hooksRelativePath);
}

export function kiroHooksScriptDir(pluginName: string): string {
  return pluginScriptDir(SCRIPTS, pluginName);
}
