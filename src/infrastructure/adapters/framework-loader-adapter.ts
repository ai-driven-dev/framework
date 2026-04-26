import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  type ConfigRef,
  type ContentSection,
  FrameworkDescriptor,
  type ScriptRef,
  type TemplateRef,
} from "../../domain/models/framework.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";

const OS_FILES = new Set([".DS_Store", "Thumbs.db"]);

const CONTENT_SECTIONS: readonly ContentSection[] = [
  { name: "agents", directory: "agents", entryFile: null },
  { name: "commands", directory: "commands", entryFile: null },
  { name: "rules", directory: "rules", entryFile: null },
  { name: "skills", directory: "skills", entryFile: "SKILL.md" },
];

const TEMPLATE_REFS: readonly TemplateRef[] = [
  { name: "agentsMd", path: "aidd_docs/templates/AGENTS.md" },
];

// Order matters for OpenCode: "mcp" must come before "opencode" because both map to
// opencode.json (merged sequentially). The transformed MCP content is written first;
// the opencode config is merged on top, so its keys take precedence on conflict.
const CONFIG_REFS: readonly ConfigRef[] = [
  { name: "mcp", path: "config/mcp.json" },
  { name: "vscodeExtensions", path: "config/vscode/extensions.json" },
  { name: "vscodeKeybindings", path: "config/vscode/keybindings.json" },
  { name: "vscodeSettings", path: "config/vscode/settings.json" },
  {
    name: "copilotVscodeSettings",
    path: "config/copilot/settings.json",
    requiredIdeId: "vscode",
  },
  { name: "opencode", path: "config/.opencode/opencode.json" },
  { name: "codex-hooks", path: "config/codex/hooks.json" },
];

const SCRIPT_REFS: readonly ScriptRef[] = [
  { name: "updateMemory", path: "config/scripts/update_memory.js", invocation: "node" },
];

const DOCS_DIR = "aidd_docs";

export class FrameworkLoaderAdapter implements FrameworkLoader {
  async loadFromDirectory(
    path: string,
    version: string
  ): Promise<{
    descriptor: FrameworkDescriptor;
    contentFiles: Map<string, string>;
    docsFiles: Map<string, string>;
  }> {
    const descriptor = new FrameworkDescriptor({
      version,
      contentSections: [...CONTENT_SECTIONS],
      templateRefs: [...TEMPLATE_REFS],
      configRefs: [...CONFIG_REFS],
      scriptRefs: [...SCRIPT_REFS],
    });

    const contentFiles = await this.loadContentFiles(path, descriptor);
    const templatePaths = new Set(descriptor.templateRefs.map((r) => r.path));
    const docsFiles = await this.loadDocsFiles(path, templatePaths);

    return { descriptor, contentFiles, docsFiles };
  }

  private async loadDocsFiles(
    frameworkPath: string,
    excludePaths: ReadonlySet<string>
  ): Promise<Map<string, string>> {
    const docsDir = join(frameworkPath, DOCS_DIR);
    const files = new Map<string, string>();
    const allFiles = await this.collectFiles(docsDir);

    for (const filePath of allFiles) {
      const relPath = relative(frameworkPath, filePath).replaceAll("\\", "/");
      if (excludePaths.has(relPath)) continue;
      const content = filePath.endsWith(".gitkeep") ? "" : await readFile(filePath, "utf-8");
      files.set(relPath, content);
    }

    return files;
  }

  private async loadContentFiles(
    basePath: string,
    descriptor: FrameworkDescriptor
  ): Promise<Map<string, string>> {
    const contentFiles = new Map<string, string>();

    for (const section of descriptor.contentSections) {
      const sectionDir = join(basePath, section.directory);
      const files = await this.collectFiles(sectionDir);

      for (const filePath of files) {
        const relativePath = relative(basePath, filePath).replaceAll("\\", "/");
        const content = await readFile(filePath, "utf-8");
        contentFiles.set(relativePath, content);
      }
    }

    for (const ref of [
      ...descriptor.templateRefs,
      ...descriptor.configRefs,
      ...descriptor.scriptRefs,
    ]) {
      const filePath = join(basePath, ref.path);
      try {
        const content = await readFile(filePath, "utf-8");
        contentFiles.set(ref.path, content);
      } catch {
        // skip missing optional refs
      }
    }

    return contentFiles;
  }

  private async collectFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (OS_FILES.has(entry.name) || entry.name.startsWith("._")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.collectFiles(fullPath);
        results.push(...nested);
      } else {
        results.push(fullPath);
      }
    }

    return results;
  }
}
