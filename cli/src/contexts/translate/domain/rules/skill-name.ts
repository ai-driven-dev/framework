import { reshapeFrontmatter } from "./frontmatter.js";

/** A skill entry named after the folder it sits in, for a tool that finds a skill by that name. */
export function namedAfterFolder(content: string, path: string): string {
  const folder = path.split("/").at(-2);
  return folder
    ? reshapeFrontmatter(content, { frontmatter: (fm) => ({ ...fm, name: folder }) })
    : content;
}
