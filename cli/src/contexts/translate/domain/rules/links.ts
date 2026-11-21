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

/** How a layout reads the links of a document: the tool's own form, or markdown links relative to
 * where the file is written. `rewriteLinks` is the one place either runs. */
export type LinkForm =
  | { readonly kind: "tool"; readonly rewrite: (content: string) => string }
  | ({ readonly kind: "relative" } & RewriteRelativeLinksOptions);

/** The tool's own reading of a link, for the layouts that install into its directory. */
export function toolLinks(tool: { rewriteContent(content: string): string }): LinkForm {
  return { kind: "tool", rewrite: (content) => tool.rewriteContent(content) };
}

export function rewriteLinks(content: string, form: LinkForm): string {
  return form.kind === "tool" ? form.rewrite(content) : rewriteRelativeLinks(content, form);
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

function rewriteClaudeRootRef(
  targetPluginRel: string,
  currentFilePluginRelative: string,
  resolveTargetPath?: (pluginRelPath: string) => string
): string {
  const resolved = resolveTargetPath ? resolveTargetPath(targetPluginRel) : targetPluginRel;
  const targetSegments = slashSegments(resolved);
  const fromSegments = slashSegments(currentFilePluginRelative).slice(0, -1);
  let shared = 0;
  while (shared < fromSegments.length && fromSegments[shared] === targetSegments[shared]) shared++;
  const linkPath = [
    ...fromSegments.slice(shared).map(() => ".."),
    ...targetSegments.slice(shared),
  ].join("/");
  const label = slashSegments(targetPluginRel).pop() ?? "";
  return `[${label}](${linkPath.startsWith(".") ? linkPath : `./${linkPath}`})`;
}

// Plugin-relative paths are posix whatever the platform, so the link is slash arithmetic, not
// `node:path`: shared domain imports no Node builtin for it. Paths are relative, never rooted,
// and never climb above the plugin root; `..` is not resolved.
function slashSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment !== "" && segment !== ".");
}
