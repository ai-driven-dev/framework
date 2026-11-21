import {
  escapeRegExp,
  SOURCE_PLUGIN_ROOT_TOKEN,
} from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import {
  applyLinkSyntax,
  type LinkSyntax,
  REFERENCE_CHARS,
} from "../../../tools/contract/link-syntax.js";

const RELATIVE_CURRENT_RE = new RegExp(`@\\.\\/(${REFERENCE_CHARS})`, "g");
const RELATIVE_PARENT_RE = new RegExp(`@\\.\\.\\/(${REFERENCE_CHARS})`, "g");

// Only with a leading `@`: a bare ${CLAUDE_PLUGIN_ROOT} is left alone.
const CLAUDE_ROOT_RE = new RegExp(
  `@${escapeRegExp(SOURCE_PLUGIN_ROOT_TOKEN)}\\/(${REFERENCE_CHARS})`,
  "g"
);

export interface RewriteRelativeLinksOptions {
  readonly currentFilePluginRelative: string;
  /** Where a plugin-relative target lands before the link is computed. Defaults to identity,
   * which keeps the link relative to the current file. */
  readonly resolveTargetPath?: (pluginRelPath: string) => string;
}

/** How a layout reads the links of a document: the tool's own form, or markdown links relative to
 * where the file is written. `rewriteLinks` is the one place either runs. */
export type LinkForm =
  | { readonly kind: "tool"; readonly syntax: LinkSyntax }
  | { readonly kind: "chain"; readonly forms: readonly LinkForm[] }
  | ({ readonly kind: "relative" } & RewriteRelativeLinksOptions);

/** The tool's own reading of a link, for the layouts that install into its directory. */
export function toolLinks(tool: { readonly linkSyntax: LinkSyntax }): LinkForm {
  return { kind: "tool", syntax: tool.linkSyntax };
}

/** The forms a document is read through, in order; none when it has none. */
export function chainLinks(...forms: readonly (LinkForm | undefined)[]): LinkForm | undefined {
  const present = forms.filter((form): form is LinkForm => form !== undefined);
  return present.length === 0 ? undefined : { kind: "chain", forms: present };
}

export function rewriteLinks(content: string, form: LinkForm): string {
  if (form.kind === "tool") return applyLinkSyntax(content, form.syntax);
  if (form.kind === "chain") return form.forms.reduce(rewriteLinks, content);
  return rewriteRelativeLinks(content, form);
}

/**
 * `@{{TOOLS}}/...` is left alone: a caller has to detect that pattern and halt on it.
 *
 * One-way: the markdown links this produces are indistinguishable from ones a person wrote,
 * so the `@`-shorthand cannot be recovered from them.
 */
function rewriteRelativeLinks(content: string, options: RewriteRelativeLinksOptions): string {
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
