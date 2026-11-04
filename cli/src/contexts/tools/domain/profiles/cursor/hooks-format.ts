/**
 * A Cursor plugin's own `hooks/hooks.json` never fires from the plugin-scope directory Cursor's
 * native install writes it to; only a project-scope `.cursor/hooks.json`, the same file a flat
 * translate already writes, is ever observed running. This module gives `aidd plugin install`
 * that same destination, one plugin at a time.
 */

import { rewriteClaudeRootInJson } from "../../../../../kernel/materialization/claude-root-path-rewrite.js";
import { genericFlatHooksScriptPath } from "../../../../../kernel/materialization/flat-paths.js";
import type { PluginHooksShape, PluginMatcherGroup } from "../../formats/plugin-hooks-shape.js";

// `timeout` is in seconds on both sides: Claude's hooks.json and Cursor's per-script option.
type CursorHookEntry = { command: string; matcher?: string; timeout?: number };
type CursorFlatShape = { version: 1; hooks: Record<string, CursorHookEntry[]> };

// `Stop` fans out to two Cursor events, not one: interactive sessions fire `stop` and headless
// ones `sessionEnd` instead — never both from the same run, but which one depends on how the
// session ends, so both are subscribed. A run file already tolerates more than one `turn_end`
// line, so a session firing both is not a problem.
const CURSOR_EVENT_MAP: Record<string, readonly string[]> = {
  SessionStart: ["sessionStart"],
  UserPromptSubmit: ["beforeSubmitPrompt"],
  PreToolUse: ["preToolUse"],
  PostToolUse: ["postToolUse"],
  Stop: ["stop", "sessionEnd"],
  SubagentStop: ["subagentStop"],
};

/** Merges a plugin's hooks (Claude nested shape) into the accumulated `.cursor/hooks.json`:
 * version 1, event-mapped keys, flat `{command}` entries. An unmapped event is skipped and
 * reported in the returned warnings. */
export function mergeCursorFlatHooks(
  existingCursorJson: string | null,
  pluginHooksJson: string
): { content: string; warnings: readonly string[] } {
  const cursor = parseCursorHooks(existingCursorJson);
  const plugin = JSON.parse(pluginHooksJson) as PluginHooksShape;
  const pluginHooks = plugin.hooks ?? {};
  const warnings: string[] = [];

  for (const [claudeEvent, matchers] of Object.entries(pluginHooks)) {
    const cursorEvents = CURSOR_EVENT_MAP[claudeEvent];
    if (!cursorEvents) {
      warnings.push(`cursor: unmapped event '${claudeEvent}' skipped`);
      continue;
    }
    const entries = extractCursorEntries(matchers);
    for (const cursorEvent of cursorEvents) {
      cursor.hooks[cursorEvent] = [...(cursor.hooks[cursorEvent] ?? []), ...entries];
    }
  }

  return { content: `${JSON.stringify(cursor, null, 2)}\n`, warnings };
}

function parseCursorHooks(content: string | null): CursorFlatShape {
  if (!content) return { version: 1, hooks: {} };
  const parsed = JSON.parse(content) as Partial<CursorFlatShape>;
  return { version: 1, hooks: parsed.hooks ?? {} };
}

function extractCursorEntries(matchers: PluginMatcherGroup[]): CursorHookEntry[] {
  const entries: CursorHookEntry[] = [];
  for (const group of matchers) {
    for (const item of group.hooks ?? []) {
      if (typeof item.command !== "string") continue;
      entries.push({
        command: item.command,
        ...(group.matcher ? { matcher: group.matcher } : {}),
        ...(typeof item.timeout === "number" ? { timeout: item.timeout } : {}),
      });
    }
  }
  return entries;
}

const HOOKS_PREFIX = "hooks/";
const CURSOR_HOOKS_DIR = ".cursor/hooks/";

interface CursorHooksFile {
  version?: number;
  hooks?: Record<string, CursorHookEntry[]>;
}

/**
 * Rewrites a plugin's raw `hooks/hooks.json` (Claude nested shape, `${CLAUDE_PLUGIN_ROOT}`
 * commands) to the paths its scripts land at under `.cursor/hooks/<plugin>/`, then merges it
 * into the project's own `.cursor/hooks.json`.
 *
 * This plugin's own prior contribution is stripped first: the merge only appends, so a second
 * install would double every command it owns. Every entry names its own script directory, a
 * plugin-unique substring, so no record of the last contribution is needed.
 */
export function mergeCursorProjectHooksJson(
  existingJson: string | null,
  pluginHooksJson: string,
  pluginName: string
): { content: string; warnings: readonly string[] } {
  const rewritten = rewritePluginRootTokens(pluginHooksJson, pluginName);
  const deduped =
    existingJson === null ? null : serialize(stripPluginEntries(existingJson, pluginName));
  return mergeCursorFlatHooks(deduped, rewritten);
}

/** Removes one plugin's entries from `.cursor/hooks.json`, leaving every other plugin's
 * untouched — what `plugin remove` unmerges an install with. */
export function unmergeCursorProjectHooksJson(existingJson: string, pluginName: string): string {
  return serialize(stripPluginEntries(existingJson, pluginName));
}

/** Where a hook script (everything under `hooks/` but its own manifest) lands once
 * copied into the project, given its path relative to the plugin root. */
export function cursorProjectHooksScriptPath(
  pluginName: string,
  hooksRelativePath: string
): string {
  const rest = hooksRelativePath.startsWith(HOOKS_PREFIX)
    ? hooksRelativePath.slice(HOOKS_PREFIX.length)
    : hooksRelativePath;
  return genericFlatHooksScriptPath(CURSOR_HOOKS_DIR, pluginName, rest);
}

/** The directory a plugin's copied hook scripts live under — nothing else writes here, so
 * `plugin remove` can delete it whole once the hooks.json entries are stripped. */
export function cursorProjectHooksScriptDir(pluginName: string): string {
  return `${CURSOR_HOOKS_DIR}${pluginName}/`;
}

function stripPluginEntries(existingJson: string, pluginName: string): CursorHooksFile {
  const parsed = JSON.parse(existingJson) as CursorHooksFile;
  const marker = cursorProjectHooksScriptDir(pluginName);
  const hooks: Record<string, CursorHookEntry[]> = {};
  for (const [event, entries] of Object.entries(parsed.hooks ?? {})) {
    const kept = entries.filter((entry) => !entry.command.includes(marker));
    if (kept.length > 0) hooks[event] = kept;
  }
  return { version: 1, hooks };
}

function serialize(cursor: CursorHooksFile): string {
  return `${JSON.stringify(cursor, null, 2)}\n`;
}

function rewritePluginRootTokens(pluginHooksJson: string, pluginName: string): string {
  const parsed = JSON.parse(pluginHooksJson) as unknown;
  const rewritten = rewriteClaudeRootInJson(parsed, (suffix) => resolveSuffix(suffix, pluginName));
  return JSON.stringify(rewritten);
}

// A hooks.json command only ever names a path under its own hooks/ — unlike the
// framework-build route, this never needs an agents/ or skills/ branch too.
function resolveSuffix(suffix: string, pluginName: string): string {
  if (!suffix.startsWith(HOOKS_PREFIX)) return suffix;
  return `./${cursorProjectHooksScriptPath(pluginName, suffix)}`;
}
