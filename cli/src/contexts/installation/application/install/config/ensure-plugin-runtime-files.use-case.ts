import { join } from "node:path";
import { FileHash } from "../../../../../shared/domain/file-hash.js";
import type { AssetProvider } from "../../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { Manifest } from "../../../domain/manifest.js";
import type { RuntimeConfigSection } from "../../../ports/tool-sections.js";

/** What the runtime files a plugin relies on are written from. */
export interface EnsurePluginRuntimeFilesDeps {
  readonly fs: FileReader & FileWriter;
  readonly assets: AssetProvider;
}

/** Writes each runtime file a tool's plugins rely on that the project lacks, and records its
 * hash. A file already on disk is left as it is, tracked or not. */
export class EnsurePluginRuntimeFiles {
  constructor(private readonly deps: EnsurePluginRuntimeFilesDeps) {}

  async execute(
    profile: Pick<RuntimeConfigSection, "toolId" | "runtimeFiles">,
    projectRoot: string,
    manifest: Manifest
  ): Promise<void> {
    const toolId = profile.toolId;
    for (const [fileName, relativePath] of Object.entries(profile.runtimeFiles())) {
      const path = join(projectRoot, relativePath);
      if (await this.deps.fs.fileExists(path)) continue;
      const asset = this.deps.assets.loadConfigAsset(toolId, fileName);
      const content = typeof asset === "string" ? asset : JSON.stringify(asset, null, 2);
      await this.deps.fs.writeFile(path, content);
      manifest.recordFileHash(toolId, relativePath, FileHash.of(content));
    }
  }
}
