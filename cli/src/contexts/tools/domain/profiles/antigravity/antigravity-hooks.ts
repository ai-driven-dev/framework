import { rewriteClaudeRootInJson } from "../../../../../kernel/materialization/claude-root-path-rewrite.js";
import { genericFlatHooksScriptPath } from "../../../../../kernel/materialization/flat-paths.js";
import type { ProjectHookEntry, ProjectHooksFormat } from "../../formats/project-hooks-format.js";
import { ANTIGRAVITY_HOOKS_DIR } from "./antigravity-paths.js";

const HOOKS_PREFIX = "hooks/";
// Claude and `agy` name their tools differently, so only the tool-free event is carried over.
const MAPPED_EVENTS = new Set(["SessionStart"]);
// agy 1.2.17 runs a workspace hook through a shell from `<repo>/.agents`, and rejects nested groups.
const FROM_REPO_ROOT = "cd .. && ";

type NamedHooks = Record<string, Record<string, ProjectHookEntry[]>>;
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
    command: `${FROM_REPO_ROOT}${hook.command}`,
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
    const kept = existingJson === null ? {} : withoutPlugin(existingJson, pluginName);
    const { events, warnings } = convert(pluginHooksJson, pluginName);
    const merged = Object.keys(events).length > 0 ? { ...kept, [pluginName]: events } : kept;
    return { content: serialize(merged), warnings };
  },
  unmerge: (existingJson, pluginName) => serialize(withoutPlugin(existingJson, pluginName)),
  contributedEntries(content, pluginName) {
    const events = (JSON.parse(content) as NamedHooks)[pluginName] ?? {};
    return Object.entries(events).flatMap(([event, entries]) =>
      entries.map((entry) => ({ event, entry }))
    );
  },
  isEmpty: (content) => Object.keys(JSON.parse(content) as NamedHooks).length === 0,
  scriptPath,
  scriptDir: (pluginName) => `${ANTIGRAVITY_HOOKS_DIR}${pluginName}/`,
};
