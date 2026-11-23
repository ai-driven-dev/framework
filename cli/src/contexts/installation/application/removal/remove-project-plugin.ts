import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { RemovedPlugin } from "../../contract/records/plugin-claims.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { ProjectIntegrationCleanup } from "../../ports/project-integration-cleanup.js";
import type { ProjectPluginIntegration } from "../../ports/tool-sections.js";
import { deletePluginFilesForTool } from "../plugin/files/delete-plugin-files.js";
import type { AssertProjectIntegrationRemovable } from "./assert-project-integration-removable.use-case.js";
import type { RemoveProjectIntegration } from "./remove-project-integration.use-case.js";

/** The machine claims a removal lets go of, supplied by the composition root. */
export interface RemovalClaims {
  readonly detachNativeRefs: (
    projectRoot: string,
    refsByTool: ReadonlyMap<ToolId, readonly string[]>
  ) => Promise<void>;
  readonly detachUserPlugin: (toolId: AiToolId, name: string, projectRoot: string) => Promise<void>;
}

/** What RemoveProjectPlugin is built from. */
export interface RemoveProjectPluginDeps {
  readonly fs: FileReader & FileWriter;
  readonly homedir: () => string;
  readonly assertIntegration: Pick<AssertProjectIntegrationRemovable, "execute">;
  readonly removeIntegration: Pick<RemoveProjectIntegration, "execute">;
  readonly claims?: RemovalClaims;
}

export class RemoveProjectPlugin implements ProjectIntegrationCleanup {
  constructor(private readonly deps: RemoveProjectPluginDeps) {}

  async assertLocalIntegrationRemovable(
    tool: ProjectPluginIntegration,
    plugin: RecordedPlugin,
    projectRoot: string
  ): Promise<void> {
    await this.deps.assertIntegration.execute({ plugin, tool, projectRoot });
  }

  async removeLocalIntegration(
    tool: ProjectPluginIntegration,
    plugin: RecordedPlugin,
    projectRoot: string
  ): Promise<void> {
    await this.deps.removeIntegration.execute({ plugin, tool, projectRoot });
  }

  async deleteLocalFiles(
    tool: ProjectPluginIntegration,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    await deletePluginFilesForTool(
      { files: plugin.files, scope: plugin.scope, tool, projectRoot, homedir: this.deps.homedir },
      this.deps.fs
    );
  }

  async detachClaims(
    projectRoot: string,
    nativeRefs: ReadonlyMap<ToolId, readonly string[]>,
    plugins: readonly RemovedPlugin[]
  ): Promise<void> {
    await this.deps.claims?.detachNativeRefs(projectRoot, nativeRefs);
    for (const { toolId, plugin } of plugins) {
      if (plugin.scope === "user") {
        await this.deps.claims?.detachUserPlugin(toolId, plugin.name, projectRoot);
      }
    }
  }
}
