import { rewriteClaudeRootInJson } from "../../../../../kernel/materialization/claude-root-path-rewrite.js";
import { genericFlatHooksScriptPath } from "../../../../../kernel/materialization/flat-paths.js";
import type { ProjectHookEntry, ProjectHooksFormat } from "../../hooks-format.js";
import { ANTIGRAVITY_HOOKS_DIR } from "./antigravity-paths.js";

const HOOKS_PREFIX = "hooks/";
// Claude and `agy` name their tools differently, so only the tool-free event is carried over.
const MAPPED_EVENTS = new Set(["SessionStart"]);
// agy runs from `<repo>/.agents` and requires JSON stdout even for a silent hook.
const JSON_RESPONSE =
  "const p=require('node:child_process').spawn(Buffer.from(process.argv[1],'base64').toString(),{shell:true,cwd:'..',stdio:['inherit','pipe','inherit']});" +
  "let empty=true;p.stdout.on('data',d=>{empty=false;process.stdout.write(d)});" +
  "p.on('close',c=>{if(empty)process.stdout.write('{}');process.exitCode=c??1});";

type NamedHook = {
  enabled?: boolean;
  [key: string]: ProjectHookEntry[] | boolean | undefined;
};
type NamedHooks = Record<string, NamedHook>;
type ClaudeHooks = { hooks?: Record<string, { hooks?: ProjectHookEntry[] }[]> };

function scriptPath(pluginName: string, hooksRelativePath: string): string {
  const rest = hooksRelativePath.startsWith(HOOKS_PREFIX)
    ? hooksRelativePath.slice(HOOKS_PREFIX.length)
    : hooksRelativePath;
  return genericFlatHooksScriptPath(ANTIGRAVITY_HOOKS_DIR, pluginName, rest);
}

function toHandler(hook: ProjectHookEntry): ProjectHookEntry {
  const handler: ProjectHookEntry = {
    type: "command",
    command: `node -e "${JSON_RESPONSE}" ${Buffer.from(hook.command).toString("base64")}`,
  };
  if (hook.timeout !== undefined) handler.timeout = hook.timeout;
  return handler;
}

function convert(
  pluginHooksJson: string,
  pluginName: string
): { events: Record<string, ProjectHookEntry[]>; warnings: string[] } {
  const parsed = JSON.parse(pluginHooksJson) as unknown;
  const rewritten = rewriteClaudeRootInJson(parsed, (suffix) =>
    suffix.startsWith(HOOKS_PREFIX) ? `./${scriptPath(pluginName, suffix)}` : suffix
  ) as ClaudeHooks;
  const events: Record<string, ProjectHookEntry[]> = {};
  const warnings: string[] = [];
  for (const [event, groups] of Object.entries(rewritten.hooks ?? {})) {
    if (!MAPPED_EVENTS.has(event)) {
      warnings.push(`antigravity: unmapped event '${event}' skipped`);
      continue;
    }
    events[event] = groups.flatMap((group) => (group.hooks ?? []).map(toHandler));
  }
  return { events, warnings };
}

function withoutPlugin(existingJson: string, pluginName: string): NamedHooks {
  const { [pluginName]: _removed, ...kept } = JSON.parse(existingJson) as NamedHooks;
  return kept;
}

function serialize(hooks: NamedHooks): string {
  return `${JSON.stringify(hooks, null, 2)}\n`;
}

export const antigravityProjectHooksFormat: ProjectHooksFormat = {
  merge(existingJson, pluginHooksJson, pluginName) {
    const { [pluginName]: previous, ...kept } =
      existingJson === null ? {} : (JSON.parse(existingJson) as NamedHooks);
    const { events, warnings } = convert(pluginHooksJson, pluginName);
    const merged =
      Object.keys(events).length > 0
        ? {
            ...kept,
            [pluginName]: {
              ...(previous?.enabled === undefined ? {} : { enabled: previous.enabled }),
              ...events,
            },
          }
        : kept;
    return { content: serialize(merged), warnings };
  },
  unmerge: (existingJson, pluginName) => serialize(withoutPlugin(existingJson, pluginName)),
  contributedEntries(content, pluginName) {
    const { enabled: _enabled, ...events } = (JSON.parse(content) as NamedHooks)[pluginName] ?? {};
    return Object.entries(events).flatMap(([event, entries]) => {
      if (!Array.isArray(entries)) {
        throw new Error(`Antigravity hook '${pluginName}.${event}' must be an array.`);
      }
      return entries.map((entry) => ({ event, entry }));
    });
  },
  isEmpty: (content) => Object.keys(JSON.parse(content) as NamedHooks).length === 0,
  scriptPath,
  scriptDir: (pluginName) => `${ANTIGRAVITY_HOOKS_DIR}${pluginName}/`,
};
