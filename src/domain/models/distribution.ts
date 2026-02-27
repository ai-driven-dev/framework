import type { Hasher } from "../ports/hasher.js";
import type { FrameworkDescriptor } from "./framework-descriptor.js";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import { GeneratedFile } from "./generated-file.js";
import type { ToolSpec } from "./tool-spec.js";

export function generateDistribution(
  framework: FrameworkDescriptor,
  toolSpec: ToolSpec,
  docsDir: string,
  contentFiles: Map<string, string>,
  hasher: Hasher
): GeneratedFile[] {
  const results: GeneratedFile[] = [];

  for (const section of framework.contentSections) {
    for (const [filePath, rawContent] of contentFiles) {
      if (!filePath.startsWith(`${section.directory}/`)) continue;

      const relativeFileName = filePath.slice(`${section.directory}/`.length);

      if (section.entryFile !== null) {
        const basename = relativeFileName.split("/").at(-1) ?? relativeFileName;
        if (basename !== section.entryFile) continue;
      }

      const { frontmatter, body } = parseFrontmatter(rawContent);

      const convertedFrontmatter = toolSpec.convertFrontmatter(frontmatter);
      const rewrittenBody = toolSpec.rewriteContent(body, docsDir);

      const outputContent = serializeFrontmatter(convertedFrontmatter, rewrittenBody);
      const outputPath = toolSpec.buildFilePath(section, relativeFileName);

      results.push(
        new GeneratedFile({
          relativePath: outputPath,
          content: outputContent,
          hash: hasher.hash(outputContent),
        })
      );
    }
  }

  for (const configRef of framework.configRefs) {
    const rawContent = contentFiles.get(configRef.path);
    if (rawContent === undefined) continue;

    const outputPath = toolSpec.getConfigOutputPath(configRef.name, configRef.path);
    if (outputPath === null) continue;

    results.push(
      new GeneratedFile({
        relativePath: outputPath,
        content: rawContent,
        hash: hasher.hash(rawContent),
      })
    );
  }

  return results;
}
