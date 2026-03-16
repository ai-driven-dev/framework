import type { Hasher } from "../ports/hasher.js";
import {
  GITKEEP_FILE,
  SECTION_AGENTS,
  SECTION_COMMANDS,
  SECTION_RULES,
  SECTION_SKILLS,
} from "./framework-descriptor.js";
import type { FrameworkDescriptor } from "./framework-descriptor.js";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import { GeneratedFile } from "./generated-file.js";
import {
  type CommandsHandler,
  type RulesHandler,
  type SectionHandler,
  type ToolConfig,
  acceptsFile,
} from "./tool-config.js";

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

      const handler = resolveHandler(toolConfig, section.name);
      if (!handler) continue;

      const outputPath = handler.buildFilePath(relativeFileName);
      if (outputPath === null) continue;

      if (relativeFileName.endsWith(GITKEEP_FILE)) {
        results.push(
          new GeneratedFile({
            relativePath: outputPath,
            content: "",
            hash: hasher.hash(""),
            frameworkPath: filePath,
          })
        );
        continue;
      }

      const rewrittenRaw = toolConfig.rewriteContent(rawContent, docsDir);
      const { frontmatter, body } = parseFrontmatter(rewrittenRaw);

      const convertedFrontmatter =
        section.name === SECTION_COMMANDS
          ? toolConfig.commands().convertFrontmatter(frontmatter, relativeFileName)
          : (handler as SectionHandler).convertFrontmatter(frontmatter);

      const outputContent = serializeFrontmatter(convertedFrontmatter, body);

      results.push(
        new GeneratedFile({
          relativePath: outputPath,
          content: outputContent,
          hash: hasher.hash(outputContent),
          frameworkPath: filePath,
        })
      );
    }
  }

  const configHandler = toolConfig.config();
  results.push(
    ...collectRawFiles(
      framework.configRefs,
      (name) => configHandler.outputPath(name),
      (name) => configHandler.shouldMerge(name),
      configHandler.transformContent?.bind(configHandler),
      contentFiles,
      hasher
    ),
    ...collectMemoryBankFiles(framework.templateRefs, toolConfig, docsDir, contentFiles, hasher)
  );

  return removeRedundantGitkeeps(results);
}

function resolveHandler(
  toolConfig: ToolConfig,
  sectionName: string
): SectionHandler | CommandsHandler | RulesHandler | null {
  switch (sectionName) {
    case SECTION_AGENTS:
      return toolConfig.agents();
    case SECTION_COMMANDS:
      return toolConfig.commands();
    case SECTION_RULES:
      return toolConfig.rules();
    case SECTION_SKILLS:
      return toolConfig.skills();
    default:
      return null;
  }
}

function removeRedundantGitkeeps(files: GeneratedFile[]): GeneratedFile[] {
  const nonEmptyDirs = new Set(
    files
      .filter((f) => !f.relativePath.endsWith(`/${GITKEEP_FILE}`))
      .map((f) => f.relativePath.split("/").slice(0, -1).join("/"))
  );
  return files.filter((f) => {
    if (!f.relativePath.endsWith(`/${GITKEEP_FILE}`)) return true;
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
    const outputPath = toolConfig.memoryBank().outputPath(ref.name);
    if (outputPath === null) return [];
    const rewritten = toolConfig.memoryBank().rewriteContent(rawContent, docsDir);
    return [
      new GeneratedFile({
        relativePath: outputPath,
        content: rewritten,
        hash: hasher.hash(rewritten),
        frameworkPath: ref.path,
      }),
    ];
  });
}

function collectRawFiles(
  refs: readonly { name: string; path: string }[],
  resolveOutput: (name: string) => string | null,
  shouldMerge: (name: string) => boolean,
  transformContent: ((name: string, content: string) => string) | undefined,
  contentFiles: Map<string, string>,
  hasher: Hasher
): GeneratedFile[] {
  return refs.flatMap((ref) => {
    const rawContent = contentFiles.get(ref.path);
    if (rawContent === undefined) return [];
    const outputPath = resolveOutput(ref.name);
    if (outputPath === null) return [];
    const content = transformContent ? transformContent(ref.name, rawContent) : rawContent;
    return [
      new GeneratedFile({
        relativePath: outputPath,
        content,
        hash: hasher.hash(content),
        merge: shouldMerge(ref.name),
        frameworkPath: ref.path,
      }),
    ];
  });
}
