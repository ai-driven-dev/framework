import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { FrameworkDescriptor } from "../../domain/models/framework-descriptor.js";
import type { FrameworkLoader } from "../../domain/ports/framework-loader.js";

export class FrameworkLoaderAdapter implements FrameworkLoader {
  async loadFromDirectory(path: string): Promise<{
    descriptor: FrameworkDescriptor;
    contentFiles: Map<string, string>;
  }> {
    const frameworkJsonPath = join(path, "framework.json");
    let rawJson: unknown;
    try {
      const raw = await readFile(frameworkJsonPath, "utf-8");
      rawJson = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read framework.json from '${path}': ${message}`);
    }

    const descriptor = FrameworkDescriptor.fromJson(rawJson);
    const contentFiles = await this.loadContentFiles(path, descriptor);

    return { descriptor, contentFiles };
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
        const relativePath = relative(basePath, filePath);
        const content = await readFile(filePath, "utf-8");
        contentFiles.set(relativePath, content);
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
