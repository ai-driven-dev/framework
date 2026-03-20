import { join } from "node:path";
import type { Manifest } from "../../domain/models/manifest.js";
import type { ToolId } from "../../domain/models/tool-config.js";
import type { FileSystem } from "../../domain/ports/file-system.js";

export interface ToolModificationCounts {
  modified: number;
  deleted: number;
}

export class SyncStatusUseCase {
  constructor(private readonly fs: FileSystem) {}

  async execute(
    manifest: Manifest,
    toolIds: ToolId[],
    projectRoot: string
  ): Promise<Record<string, ToolModificationCounts>> {
    const result: Record<string, ToolModificationCounts> = {};
    for (const toolId of toolIds) {
      const files = manifest.getToolFiles(toolId);
      let modified = 0;
      let deleted = 0;
      for (const file of files) {
        const diskPath = join(projectRoot, file.relativePath);
        if (!(await this.fs.fileExists(diskPath))) {
          deleted++;
          continue;
        }
        const diskHash = await this.fs.readFileHash(diskPath);
        if (diskHash.value !== file.hash.value) modified++;
      }
      result[toolId] = { modified, deleted };
    }
    return result;
  }
}
