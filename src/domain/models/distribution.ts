import type { Hasher } from "../ports/hasher.js";
import type { FrameworkDescriptor } from "./framework-descriptor.js";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import { GeneratedFile } from "./generated-file.js";
import { type ToolConfig, acceptsFile } from "./tool-config.js";

export function generateDistribution(
  framework: FrameworkDescriptor,
  toolConfig: ToolConfig,
  docsDir: string,
  contentFiles: Map<string, string>,
  hasher: Hasher
): GeneratedFile[] {
  const results: GeneratedFile[] = [];

  for (const section of framework.contentSections) {
    for (const [filePath, rawContent] of contentFiles) {
      if (!filePath.startsWith(`${section.directory}/`)) continue;

      const relativeFileName = filePath.slice(`${section.directory}/`.length);

      if (!acceptsFile(toolConfig, relativeFileName)) continue;

      if (section.entryFile !== null) {
        const basename = relativeFileName.split("/").at(-1) ?? relativeFileName;
        if (basename !== section.entryFile) continue;
      }

      const outputPath = toolConfig.buildFilePath(section, relativeFileName);
      if (outputPath === null) continue;

      const rewrittenRaw = toolConfig.rewriteContent(rawContent, docsDir);
      const { frontmatter, body } = parseFrontmatter(rewrittenRaw);

      if (toolConfig.shouldProcess?.(section, frontmatter) === false) continue;

      const convertedFrontmatter = toolConfig.convertFrontmatter(frontmatter, section);
      const rewrittenBody = body;

      const outputContent = serializeFrontmatter(convertedFrontmatter, rewrittenBody);

      results.push(
        new GeneratedFile({
          relativePath: outputPath,
          content: outputContent,
          hash: hasher.hash(outputContent),
        })
      );
    }
  }

  results.push(
    ...collectRawFiles(
      framework.configRefs,
      (name) => toolConfig.getConfigOutputPath(name),
      contentFiles,
      hasher
    ),
    ...collectMemoryBankFiles(framework.templateRefs, toolConfig, docsDir, contentFiles, hasher)
  );

  return removeRedundantGitkeeps(results);
}

function removeRedundantGitkeeps(files: GeneratedFile[]): GeneratedFile[] {
  const nonEmptyDirs = new Set(
    files
      .filter((f) => !f.relativePath.endsWith("/.gitkeep"))
      .map((f) => f.relativePath.split("/").slice(0, -1).join("/"))
  );
  return files.filter((f) => {
    if (!f.relativePath.endsWith("/.gitkeep")) return true;
    const dir = f.relativePath.split("/").slice(0, -1).join("/");
    return !nonEmptyDirs.has(dir);
  });
}

function collectMemoryBankFiles(
  refs: readonly { name: string; path: string }[],
  toolConfig: ToolConfig,
  docsDir: string,
  contentFiles: Map<string, string>,
  hasher: Hasher
): GeneratedFile[] {
  return refs.flatMap((ref) => {
    const rawContent = contentFiles.get(ref.path);
    if (rawContent === undefined) return [];
    const outputPath = toolConfig.getMemoryBankOutputPath(ref.name);
    if (outputPath === null) return [];
    const rewrite = toolConfig.rewriteMemoryBankContent ?? toolConfig.rewriteContent;
    const rewritten = rewrite(rawContent, docsDir);
    return [
      new GeneratedFile({
        relativePath: outputPath,
        content: rewritten,
        hash: hasher.hash(rewritten),
      }),
    ];
  });
}

function collectRawFiles(
  refs: readonly { name: string; path: string }[],
  resolveOutput: (name: string) => string | null,
  contentFiles: Map<string, string>,
  hasher: Hasher
): GeneratedFile[] {
  return refs.flatMap((ref) => {
    const rawContent = contentFiles.get(ref.path);
    if (rawContent === undefined) return [];
    const outputPath = resolveOutput(ref.name);
    if (outputPath === null) return [];
    return [
      new GeneratedFile({
        relativePath: outputPath,
        content: rawContent,
        hash: hasher.hash(rawContent),
      }),
    ];
  });
}
