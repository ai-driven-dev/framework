import type { FileSystem } from "../ports/file-system.js";
import type { Hasher } from "../ports/hasher.js";
import type { Platform } from "../ports/platform.js";
import type { FrameworkDescriptor } from "./framework-descriptor.js";
import {
  CONFIG_MCP,
  GITKEEP_FILE,
  SECTION_AGENTS,
  SECTION_COMMANDS,
  SECTION_RULES,
  SECTION_SKILLS,
} from "./framework-descriptor.js";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.js";
import { GeneratedFile } from "./generated-file.js";
import { transformFor as mcpTransformFor } from "./mcp.js";
import type { MergeStrategy } from "./merge-strategy.js";
import {
  type AiToolConfig,
  acceptsFile,
  type CommandsHandler,
  type ConfigHandler,
  isAiToolConfig,
  type RulesHandler,
  type SectionHandler,
  type ToolConfig,
} from "./tool-config.js";

type ContentTransform = (content: string) => string;

export async function generateDistribution(
  framework: FrameworkDescriptor,
  toolConfig: AiToolConfig,
  docsDir: string,
  contentFiles: Map<string, string>,
  hasher: Hasher,
  platform: Platform,
  projectRoot: string,
  fs: FileSystem
): Promise<GeneratedFile[]> {
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

  const configFiles = await collectConfigFiles(
    framework,
    toolConfig.config(),
    contentFiles,
    hasher,
    platform,
    projectRoot,
    fs
  );
  results.push(
    ...configFiles,
    ...collectMemoryBankFiles(framework.templateRefs, toolConfig, docsDir, contentFiles, hasher)
  );

  return removeRedundantGitkeeps(results);
}

async function generateConfigDistribution(
  framework: FrameworkDescriptor,
  toolConfig: ToolConfig,
  contentFiles: Map<string, string>,
  hasher: Hasher,
  platform: Platform,
  projectRoot: string,
  fs: FileSystem
): Promise<GeneratedFile[]> {
  const results = await collectConfigFiles(
    framework,
    toolConfig.config(),
    contentFiles,
    hasher,
    platform,
    projectRoot,
    fs
  );
  return removeRedundantGitkeeps(results);
}

export async function generateForConfig(
  config: ToolConfig,
  framework: FrameworkDescriptor,
  docsDir: string,
  contentFiles: Map<string, string>,
  hasher: Hasher,
  platform: Platform,
  projectRoot: string,
  fs: FileSystem
): Promise<GeneratedFile[]> {
  if (isAiToolConfig(config)) {
    return generateDistribution(
      framework,
      config,
      docsDir,
      contentFiles,
      hasher,
      platform,
      projectRoot,
      fs
    );
  }
  return generateConfigDistribution(
    framework,
    config,
    contentFiles,
    hasher,
    platform,
    projectRoot,
    fs
  );
}

async function collectConfigFiles(
  framework: FrameworkDescriptor,
  configHandler: ConfigHandler,
  contentFiles: Map<string, string>,
  hasher: Hasher,
  platform: Platform,
  projectRoot: string,
  fs: FileSystem
): Promise<GeneratedFile[]> {
  const currentPlatform = platform.current();
  const transforms = new Map<string, ContentTransform>();
  const mcpTransform = mcpTransformFor(currentPlatform);
  if (mcpTransform) transforms.set(CONFIG_MCP, mcpTransform);

  const resolveOutput = async (name: string): Promise<string | null> => {
    if (configHandler.resolveOutputPath) {
      return configHandler.resolveOutputPath(name, projectRoot, fs);
    }
    return configHandler.outputPath(name);
  };

  return collectRawFiles(
    framework.configRefs,
    resolveOutput,
    (name) => configHandler.mergeStrategy(name),
    configHandler.transformContent?.bind(configHandler),
    contentFiles,
    hasher,
    transforms
  );
}

function resolveHandler(
  toolConfig: AiToolConfig,
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
  toolConfig: AiToolConfig,
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

async function collectRawFiles(
  refs: readonly { name: string; path: string }[],
  resolveOutput: (name: string) => Promise<string | null>,
  mergeStrategy: (name: string) => MergeStrategy,
  transformContent: ((name: string, content: string) => string) | undefined,
  contentFiles: Map<string, string>,
  hasher: Hasher,
  transforms: Map<string, ContentTransform>
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];
  for (const ref of refs) {
    const rawContent = contentFiles.get(ref.path);
    if (rawContent === undefined) continue;
    const outputPath = await resolveOutput(ref.name);
    if (outputPath === null) continue;
    const toolContent = transformContent ? transformContent(ref.name, rawContent) : rawContent;
    const content = transforms.get(ref.name)?.(toolContent) ?? toolContent;
    results.push(
      new GeneratedFile({
        relativePath: outputPath,
        content,
        hash: hasher.hash(content),
        mergeStrategy: mergeStrategy(ref.name),
        frameworkPath: ref.path,
      })
    );
  }
  return results;
}
