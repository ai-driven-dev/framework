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

  results.push(
    ...collectRawFiles(
      framework.configRefs,
      (name) => toolSpec.getConfigOutputPath(name),
      contentFiles,
      hasher
    ),
    ...collectRawFiles(
      framework.templateRefs,
      (name) => toolSpec.getMemoryBankOutputPath(name),
      contentFiles,
      hasher
    )
  );

  return results;
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
