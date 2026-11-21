import { parseFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";

/** A skill entry named after the folder it sits in, for a tool that finds a skill by that name. */
export function namedAfterFolder(content: string, path: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const folder = path.split("/").at(-2);
  return folder ? serializeFrontmatter({ ...frontmatter, name: folder }, body) : content;
}
