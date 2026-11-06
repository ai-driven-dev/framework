import { basename, dirname, posix } from "node:path";

// The same character class `rewriteCopilotContent` uses, so both recognise the same
// reference.
const REFERENCE_CHAR_CLASS = "[^\\s`'\">,]+";

const RELATIVE_CURRENT_RE = new RegExp(`@\\.\\/(${REFERENCE_CHAR_CLASS})`, "g");
const RELATIVE_PARENT_RE = new RegExp(`@\\.\\.\\/(${REFERENCE_CHAR_CLASS})`, "g");

// Only with a leading `@`: a bare ${CLAUDE_PLUGIN_ROOT} is left alone.
const CLAUDE_ROOT_RE = new RegExp(`@\\$\\{CLAUDE_PLUGIN_ROOT\\}\\/(${REFERENCE_CHAR_CLASS})`, "g");

export interface RewriteRelativeLinksOptions {
  readonly currentFilePluginRelative: string;
  /** Where a plugin-relative target lands before the link is computed. Defaults to identity,
   * which keeps the link relative to the current file. */
  readonly resolveTargetPath?: (pluginRelPath: string) => string;
}

/**
 * `@{{TOOLS}}/...` is left alone: a caller has to detect that pattern and halt on it.
 *
 * One-way: the markdown links this produces are indistinguishable from ones a person wrote,
 * so the `@`-shorthand cannot be recovered from them.
 */
export function rewriteRelativeLinks(
  content: string,
  options: RewriteRelativeLinksOptions
): string {
  const afterParent = content.replace(RELATIVE_PARENT_RE, "[$1](../$1)");
  const afterCurrent = afterParent.replace(RELATIVE_CURRENT_RE, "[$1](./$1)");
  return afterCurrent.replace(CLAUDE_ROOT_RE, (_match, rel: string) =>
    rewriteClaudeRootRef(rel, options.currentFilePluginRelative, options.resolveTargetPath)
  );
}

const MARKDOWN_LINK_TARGET_RE = /\]\(([^)\s]+)\)/g;
const RELATIVE_AT_RE = new RegExp(`@(\\.{1,2}\\/${REFERENCE_CHAR_CLASS})`, "g");
const NON_RELATIVE_TARGET_RE = /^(?:[a-z][a-z0-9+.-]*:|\/|#|<|@)/i;

export interface RelocateRelativeLinksOptions {
  readonly sourceFilePluginRelative: string;
  readonly materializedFileRelative: string;
  /** Where a plugin-relative target lands; `null` leaves a link to it untouched. */
  readonly resolveTargetPath: (pluginRelPath: string) => string | null;
}

/** For a file that moves on materialization: its relative links keep pointing at the same targets. */
export function relocateRelativeLinks(
  content: string,
  options: RelocateRelativeLinksOptions
): string {
  const relocate = (ref: string): string | null => {
    const hashAt = ref.indexOf("#");
    const path = hashAt === -1 ? ref : ref.slice(0, hashAt);
    const fragment = hashAt === -1 ? "" : ref.slice(hashAt);
    const fromSource = posix.normalize(
      posix.join(posix.dirname(options.sourceFilePluginRelative), path)
    );
    if (fromSource.startsWith("../")) return null;
    const resolved = options.resolveTargetPath(fromSource);
    if (resolved === null) return null;
    let linkPath = posix.relative(posix.dirname(options.materializedFileRelative), resolved);
    if (!linkPath.startsWith(".")) linkPath = `./${linkPath}`;
    return `${linkPath}${fragment}`;
  };
  const afterMarkdown = content.replace(MARKDOWN_LINK_TARGET_RE, (match, ref: string) => {
    if (NON_RELATIVE_TARGET_RE.test(ref)) return match;
    const relocated = relocate(ref);
    return relocated === null ? match : `](${relocated})`;
  });
  const afterAt = afterMarkdown.replace(RELATIVE_AT_RE, (match, ref: string) => {
    const relocated = relocate(ref);
    return relocated === null ? match : `[${basename(ref)}](${relocated})`;
  });
  return rewriteRelativeLinks(afterAt, {
    currentFilePluginRelative: options.materializedFileRelative,
    resolveTargetPath: (rel) => options.resolveTargetPath(rel) ?? rel,
  });
}

function rewriteClaudeRootRef(
  targetPluginRel: string,
  currentFilePluginRelative: string,
  resolveTargetPath?: (pluginRelPath: string) => string
): string {
  const resolved = resolveTargetPath ? resolveTargetPath(targetPluginRel) : targetPluginRel;
  const currentDirPluginRel = dirname(currentFilePluginRelative);
  let linkPath = posix.relative(currentDirPluginRel, resolved);
  if (!linkPath.startsWith(".")) linkPath = `./${linkPath}`;
  const label = basename(targetPluginRel);
  return `[${label}](${linkPath})`;
}
