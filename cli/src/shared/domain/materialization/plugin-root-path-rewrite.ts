import { asPlainObject } from "../reading/plain-object.js";

// Written as a split literal to avoid biome's noTemplateCurlyInString warning.
/** The variable plugins are authored against: the one spelling of it in the source. */
export const SOURCE_PLUGIN_ROOT_TOKEN = "$" + "{CLAUDE_PLUGIN_ROOT}";
const SOURCE_ROOT_PREFIX = `${SOURCE_PLUGIN_ROOT_TOKEN}/`;
const DEFAULT_RELATIVE_PREFIX = "./";

/** String values only, never keys: a key name carrying the same prefix is left untouched.
 * `substitute` receives the suffix and returns its replacement, defaulting to `./<suffix>`. */
export function rewritePluginRootInJson(
  parsed: unknown,
  substitute?: (suffix: string) => string
): unknown {
  if (typeof parsed === "string") return rewriteStringValue(parsed, substitute);
  if (Array.isArray(parsed)) return parsed.map((item) => rewritePluginRootInJson(item, substitute));
  const object = asPlainObject(parsed);
  if (object !== null) return rewriteObject(object, substitute);
  return parsed;
}

function rewriteStringValue(value: string, substitute?: (suffix: string) => string): string {
  if (!substitute) return value.replaceAll(SOURCE_ROOT_PREFIX, DEFAULT_RELATIVE_PREFIX);
  return value.split(SOURCE_ROOT_PREFIX).reduce((acc, segment) => {
    const spaceIdx = segment.search(/[\s"'<>]/);
    const suffix = spaceIdx === -1 ? segment : segment.slice(0, spaceIdx);
    const rest = spaceIdx === -1 ? "" : segment.slice(spaceIdx);
    return acc + substitute(suffix) + rest;
  });
}

function rewriteObject(
  obj: Record<string, unknown>,
  substitute?: (suffix: string) => string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = rewritePluginRootInJson(value, substitute);
  }
  return result;
}

/** The folders a text names below the plugin root, each once: `bin` for `${CLAUDE_PLUGIN_ROOT}/bin/run.js`.
 * A file straight under the root names none. */
export function pluginRootFolders(content: string): string[] {
  const folders = new Set<string>();
  for (const segment of content.split(SOURCE_ROOT_PREFIX).slice(1)) {
    const end = segment.search(/[\s"'<>]/);
    const suffix = end === -1 ? segment : segment.slice(0, end);
    const slash = suffix.indexOf("/");
    if (slash > 0) folders.add(suffix.slice(0, slash));
  }
  return [...folders];
}

/** A literal, escaped to match itself inside a regular expression. */
export function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces every occurrence of the canonical `${CLAUDE_PLUGIN_ROOT}` source token with the one
 * this tool expands, declared on that tool as `plugins.pluginRootToken`. Only that literal path
 * token is rewritten, every other `${…}` variable is left untouched, and a target equal to
 * the source returns the content unchanged.
 */
export function rewritePluginRootToken(content: string, targetToken: string): string {
  return content.replaceAll(SOURCE_PLUGIN_ROOT_TOKEN, targetToken);
}
