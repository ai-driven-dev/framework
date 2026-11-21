import type { MarkdownSectionAnswers } from "../../../../src/contexts/tools/contract/tool-profile.js";

/** A section installing each file where `installAt` says, and carrying its content as it is. */
export function markdownSectionInstalling(
  installAt: (fileName: string) => string | null = (fileName) => `.fake/${fileName}`
): MarkdownSectionAnswers {
  return {
    buildInstallPath: installAt,
    convertFrontmatter: (frontmatter) => frontmatter,
    serialize: (_frontmatter, body) => body,
  };
}
