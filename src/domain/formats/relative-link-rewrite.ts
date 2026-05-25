import { basename, dirname, posix } from "node:path";

// Matches the same non-whitespace, non-quote, non-bracket character class used
// in copilot.ts::rewriteCopilotContent for consistency.
const REFERENCE_CHAR_CLASS = "[^\\s`'\">,]+";

const RELATIVE_CURRENT_RE = new RegExp(`@\\.\\/(${REFERENCE_CHAR_CLASS})`, "g");
const RELATIVE_PARENT_RE = new RegExp(`@\\.\\.\\/(${REFERENCE_CHAR_CLASS})`, "g");

// Matches @${CLAUDE_PLUGIN_ROOT}/<rel> — only when prefixed with @ (spec C-v2.2).
// The variable part is written as a split literal to avoid biome's noTemplateCurlyInString warning.
const CLAUDE_ROOT_PREFIX = "@$" + "{CLAUDE_PLUGIN_ROOT}/";
const CLAUDE_ROOT_RE = new RegExp(`@\\$\\{CLAUDE_PLUGIN_ROOT\\}\\/(${REFERENCE_CHAR_CLASS})`, "g");

export interface RewriteRelativeLinksOptions {
  readonly currentFilePluginRelative: string;
}

/**
 * Rewrites @./X → [X](./X), @../X → [X](../X), and
 * @${CLAUDE_PLUGIN_ROOT}/<rel> → a markdown link with a relative path computed
 * from the current file's plugin-relative location (spec §"Content rewrite" rules 1–3).
 *
 * Does NOT rewrite @{{TOOLS}}/... — callers must detect and halt on that pattern.
 * Does NOT touch bare ${CLAUDE_PLUGIN_ROOT} without a leading @ (spec C-v2.2).
 */
export function rewriteRelativeLinks(
  content: string,
  options: RewriteRelativeLinksOptions
): string {
  const afterParent = content.replace(RELATIVE_PARENT_RE, "[$1](../$1)");
  const afterCurrent = afterParent.replace(RELATIVE_CURRENT_RE, "[$1](./$1)");
  return afterCurrent.replace(CLAUDE_ROOT_RE, (_match, rel: string) =>
    rewriteClaudeRootRef(rel, options.currentFilePluginRelative)
  );
}

function rewriteClaudeRootRef(targetPluginRel: string, currentFilePluginRelative: string): string {
  const currentDirPluginRel = dirname(currentFilePluginRelative);
  let linkPath = posix.relative(currentDirPluginRel, targetPluginRel);
  if (!linkPath.startsWith(".")) linkPath = `./${linkPath}`;
  const label = basename(targetPluginRel);
  return `[${label}](${linkPath})`;
}

// Exported only for test assertions that check the prefix is handled correctly.
export { CLAUDE_ROOT_PREFIX as _CLAUDE_ROOT_PREFIX };
