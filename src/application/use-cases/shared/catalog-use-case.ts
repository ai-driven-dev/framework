import { join } from "node:path";
import { parseFrontmatter } from "../../../domain/formats/markdown.js";
import { type CatalogFile, generateCatalogContent } from "../../../domain/models/catalog.js";
import { FRAMEWORK_CONFIG_PREFIX, GITKEEP_FILE } from "../../../domain/models/framework.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { Plugin } from "../../../domain/models/plugin.js";
import type { ToolId } from "../../../domain/models/tool-ids.js";
import type { FileSystem } from "../../../domain/ports/file-system.js";
import { getToolConfig, isAiTool } from "../../../domain/tools/registry.js";

const PLUGIN_CONTENT_SECTIONS = new Set(["agents", "commands", "rules", "skills"]);

interface CatalogOptions {
  manifest: Manifest;
  docsDir: string;
  projectRoot: string;
}

function isCatalogExcluded(frameworkPath: string): boolean {
  const parts = frameworkPath.split("/");
  return (
    parts.at(-1) === GITKEEP_FILE ||
    parts.some((p) => p.startsWith(".")) ||
    frameworkPath.startsWith(FRAMEWORK_CONFIG_PREFIX)
  );
}

export class CatalogUseCase {
  constructor(private readonly fs: FileSystem) {}

  async execute({ manifest, docsDir, projectRoot }: CatalogOptions): Promise<void> {
    const files = await this.buildCatalogFiles(manifest, projectRoot);
    const content = generateCatalogContent(files, docsDir);
    await this.fs.writeFile(join(projectRoot, docsDir, "CATALOG.md"), content);
  }

  private async buildCatalogFiles(manifest: Manifest, projectRoot: string): Promise<CatalogFile[]> {
    const files: CatalogFile[] = [];

    for (const toolId of manifest.getInstalledToolIds()) {
      for (const tracked of manifest.getToolFiles(toolId)) {
        const frameworkPath = tracked.frameworkPath ?? tracked.relativePath;
        if (isCatalogExcluded(frameworkPath)) continue;
        const frontmatter = await this.readFrontmatter(join(projectRoot, tracked.relativePath));
        files.push({ frameworkPath, installedPath: tracked.relativePath, toolId, frontmatter });
      }
      await this.addPluginFiles(manifest, toolId, projectRoot, files);
    }

    return files;
  }

  private async addPluginFiles(
    manifest: Manifest,
    toolId: ToolId,
    projectRoot: string,
    files: CatalogFile[]
  ): Promise<void> {
    const toolConfig = getToolConfig(toolId);
    if (toolConfig === undefined || !isAiTool(toolConfig)) return;
    const caps = toolConfig.capabilities as Record<string, unknown>;
    if (!("plugins" in caps)) return;
    const pluginsDir = (caps.plugins as { pluginsDir: string | null }).pluginsDir;
    if (pluginsDir === null) return;

    for (const plugin of manifest.getPlugins(toolId)) {
      await this.addPluginContentFiles(plugin, pluginsDir, toolId, projectRoot, files);
    }
  }

  private async addPluginContentFiles(
    plugin: Plugin,
    pluginsDir: string,
    toolId: ToolId,
    projectRoot: string,
    files: CatalogFile[]
  ): Promise<void> {
    const pluginRoot = `${pluginsDir}${plugin.name}/`;
    for (const installedPath of plugin.files.keys()) {
      if (!installedPath.startsWith(pluginRoot)) continue;
      const frameworkPath = installedPath.slice(pluginRoot.length);
      const section = frameworkPath.split("/")[0];
      if (!PLUGIN_CONTENT_SECTIONS.has(section)) continue;
      const frontmatter = await this.readFrontmatter(join(projectRoot, installedPath));
      files.push({ frameworkPath, installedPath, toolId, frontmatter });
    }
  }

  private async readFrontmatter(absPath: string): Promise<Record<string, unknown>> {
    try {
      const content = await this.fs.readFile(absPath);
      return parseFrontmatter(content).frontmatter;
    } catch {
      return {};
    }
  }
}
