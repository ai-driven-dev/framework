import type { OutputFile } from "./output-file.js";

export const PLUGIN_HOOKS_DIR = "hooks";
const MARKDOWN_EXTENSION = ".md";

export function parentDirOf(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

// A hook script requires its siblings relative to itself, so the tree below hooks/ has to
// survive translation intact; flattening it breaks every such require.
export function pathBelowHooks(path: string): string {
  return path.slice(PLUGIN_HOOKS_DIR.length + 1);
}

export function makeFile(relativePath: string, content: string): OutputFile {
  return { relativePath, content };
}

/** Prose is translated; anything else a plugin ships is an artefact, carried byte for byte. The
 * extension is the whole test: a plugin's components are markdown by definition. */
export function isProse(relativePath: string): boolean {
  return relativePath.endsWith(MARKDOWN_EXTENSION);
}

export function isComponentFile(relativePath: string): boolean {
  const top = relativePath.split("/")[0];
  return top === "agents" || top === "commands" || top === "rules" || top === "skills";
}

export function basename(relativePath: string): string {
  return relativePath.split("/").at(-1) ?? relativePath;
}
