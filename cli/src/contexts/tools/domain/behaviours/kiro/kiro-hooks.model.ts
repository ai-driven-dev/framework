/** Kiro's hooks file: a `version` and a flat `hooks` list of named hooks, each a trigger and a
 * command action (https://kiro.dev/docs/hooks/). No `HooksFileFormat` describes that list, so its
 * merge is Kiro's own.
 *
 * Only a command of the form `node ${CLAUDE_PLUGIN_ROOT}/hooks/...` is delivered; any other is
 * dropped, and no plugin ships one. Only `SessionStart` is delivered, so a script paired across
 * events (aidd-context's artifacts start, mark and check) runs only its SessionStart half, which
 * is harmless. */

import type { ShippedHooks } from "../../../../../shared/domain/materialization/build-contract.js";
import { genericFlatHooksScriptPath } from "../../../../../shared/domain/materialization/flat-paths.js";
import { asPlainObject } from "../../../../../shared/domain/reading/plain-object.js";
import type { ProjectHooksFormat } from "../../../contract/tool-vocabulary.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { pluginScriptDir, pluginScriptPath } from "../../hooks/hooks-merge.js";
import { unmappedEventWarning } from "../../hooks/hooks-warnings.js";
import {
  type BridgeHookCall,
  bridgeHookCalls,
  type PluginHookItem,
  type PluginMatcherGroup,
} from "../../hooks/plugin-hooks-shape.js";

export type KiroHooks = HooksRouting & {
  readonly flat: FlatHooksRoute;
  readonly eventMap: Readonly<Record<string, string>>;
};

interface KiroHook {
  readonly name: string;
  readonly trigger: string;
  readonly action: { readonly type: string; readonly command?: string };
  readonly timeout?: number;
}

const VERSION = "v1";

/** Kiro names no variable for where a hooks file lives, so a command finds its script itself.
 * The home copy wins: a repository must not have its script run by a hook installed in the home. */
function launcher(scriptsDir: string, plugin: string, call: BridgeHookCall): string {
  const relative = genericFlatHooksScriptPath(scriptsDir, plugin, call.script);
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

function toKiroHooks(
  scriptsDir: string,
  plugin: string,
  { trigger, item }: { trigger: string; item: PluginHookItem }
): KiroHook[] {
  return bridgeHookCalls([{ hooks: [item] }]).map((call) => ({
    name: `${plugin}-${call.script}`,
    trigger,
    action: { type: "command", command: launcher(scriptsDir, plugin, call) },
    ...(typeof item.timeout === "number" ? { timeout: item.timeout } : {}),
  }));
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
    const items = groups.flatMap((group) => group.hooks ?? []);
    added.push(
      ...items.flatMap((item) =>
        toKiroHooks(hooks.flat.scriptsDir, shipped.plugin, { trigger, item })
      )
    );
  }
  return { content: serialize(existingJson, [...kept, ...added]), warnings };
}

/** How Kiro's `.kiro/hooks/aidd.json` holds a plugin's entries. */
export function kiroHooksFormat(hooks: KiroHooks): ProjectHooksFormat {
  const scripts = hooks.flat.scriptsDir;
  return {
    merge: (existing, json, plugin) => mergeKiroHooks(hooks, existing, { json, plugin }),
    unmerge: (existing, plugin) =>
      serialize(
        existing,
        hooksOf(existing).filter((hook) => !runs(hooks, hook, plugin))
      ),
    contributedEntries: (content, plugin) =>
      hooksOf(content)
        .filter((hook) => runs(hooks, hook, plugin))
        .map(({ name, trigger, action, timeout }) => ({
          event: trigger,
          entry: {
            name,
            command: action.command ?? "",
            ...(timeout === undefined ? {} : { timeout }),
          },
        })),
    isEmpty: (content) => hooksOf(content).length === 0,
    scriptPath: (plugin, relativePath) => pluginScriptPath(scripts, plugin, relativePath),
    scriptDir: (plugin) => pluginScriptDir(scripts, plugin),
  };
}
