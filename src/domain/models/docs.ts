import type { Hasher } from "../ports/hasher.js";
import { GeneratedFile } from "./generated-file.js";

const FRAMEWORK_DOCS_PREFIX = "aidd_docs";

export function remapDocsPath(frameworkRelPath: string, docsDir: string): string {
  if (frameworkRelPath.startsWith(`${FRAMEWORK_DOCS_PREFIX}/`)) {
    return `${docsDir}/${frameworkRelPath.slice(FRAMEWORK_DOCS_PREFIX.length + 1)}`;
  }
  return frameworkRelPath;
}

export function rewriteDocsContent(content: string, docsDir: string): string {
  return content.replaceAll("{{DOCS}}/", `${docsDir}/`).replaceAll("{{TOOLS}}/", `${docsDir}/`);
}

export function buildDocsDistribution(
  docsFiles: Map<string, string>,
  docsDir: string,
  hasher: Hasher
): GeneratedFile[] {
  const generated: GeneratedFile[] = [];
  for (const [frameworkRelPath, rawContent] of docsFiles.entries()) {
    if (frameworkRelPath.endsWith("CATALOG.md")) continue;
    const relativePath = remapDocsPath(frameworkRelPath, docsDir);
    const content = rewriteDocsContent(rawContent, docsDir);
    const hash = hasher.hash(content);
    generated.push(new GeneratedFile({ relativePath, content, hash }));
  }
  return generated;
}
