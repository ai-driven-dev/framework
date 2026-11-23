/** The characters one reference to a file is made of: it ends at a space, a quote, a backtick, a
 * comma or a closing bracket. The one spelling every reader of a reference shares. */
export const REFERENCE_CHARS = "[^\\s`'\">,]+";

/** One reading of a reference in prose: what it matches, and what the tool writes in its place. */
export interface LinkRule {
  readonly from: RegExp;
  readonly to: string | ((match: string, ...groups: string[]) => string);
}

/** How a tool writes the references of its documents, as data. The rules apply in order; the
 * translation's one link rule reads them. */
export type LinkSyntax = readonly LinkRule[];

/** Writes `content` the way `syntax` says: each rule in turn, the one place a syntax is read. */
export function applyLinkSyntax(content: string, syntax: LinkSyntax): string {
  return syntax.reduce(
    (text, { from, to }) =>
      typeof to === "string" ? text.replace(from, to) : text.replace(from, to),
    content
  );
}
