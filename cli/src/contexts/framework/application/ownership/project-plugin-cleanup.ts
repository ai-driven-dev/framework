import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { AiToolId, ToolId } from "../../../../kernel/tool.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";
import { detachNativePluginRefs } from "./native-plugin-ownership.js";
import { detachUserPlugin } from "./user-plugin-ownership.js";

export class ProjectPluginCleanup {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly userManifestRepo?: ManifestRepository
  ) {}

  async deleteLocalFiles(
    toolId: AiToolId,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    await deletePluginFilesForTool(plugin.files, plugin.scope, toolId, projectRoot, this.fs);
  }

  async detachClaims(
    projectRoot: string,
    nativeRefs: ReadonlyMap<ToolId, readonly string[]>,
    plugins: readonly { toolId: AiToolId; plugin: InstalledPlugin }[]
  ): Promise<void> {
    await detachNativePluginRefs(this.userManifestRepo, this.fs, projectRoot, nativeRefs);
    for (const { toolId, plugin } of plugins) {
      if (plugin.scope === "user") {
        await detachUserPlugin(this.userManifestRepo, this.fs, toolId, plugin.name, projectRoot);
      }
    }
  }
}
