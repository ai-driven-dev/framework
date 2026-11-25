import { reshapeFrontmatter } from "../../../../shared/domain/markdown.js";
import { basename } from "../plugin-paths.js";

/** A command named `<prefix><plugin>:<name>`, the name its source carries stripped of its own prefix. */
export function prefixCommandName(
  content: string,
  at: { source: string; prefix: string; pluginName: string }
): string {
  return reshapeFrontmatter(content, {
    frontmatter: (frontmatter) => {
      const rawName = typeof frontmatter.name === "string" ? frontmatter.name : "";
      const simpleName = stripCommandPrefix(rawName) || basename(at.source);
      return { ...frontmatter, name: `${at.prefix}${at.pluginName}:${simpleName}` };
    },
  });
}

function stripCommandPrefix(name: string): string {
  const match = /^aidd:\d+:(.+)$/.exec(name);
  if (match) return match[1];
  return name.slice(name.lastIndexOf(":") + 1);
}
