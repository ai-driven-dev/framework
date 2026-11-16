import { join } from "node:path";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import { assertProjectPathWithinRoot } from "../../../installation/application/ownership/project-path-boundary.js";
import { deletePluginFilesForTool } from "../../../installation/application/plugin/plugin-helpers.js";
import {
  assertProjectHooksRemovable,
  removeProjectHooks,
} from "../../../installation/application/shared/remove-project-hooks.js";
import type { RemovedPlugin } from "../../../installation/contract/plugin-claims.js";
import type { InstalledPlugin } from "../../../installation/domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../../installation/ports/manifest-repository.js";
import { detachNativePluginRefs } from "../../../machine-claims/application/native-plugin-ownership.js";
import { detachUserPlugin } from "../../../machine-claims/application/user-plugin-ownership.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";

/** Read-only OpenCode MCP proof, shared by Clean and local plugin removals before any detach. */
export async function assertProjectMcpEntriesRemovable(
  fs: FileReader,
  plugin: InstalledPlugin,
  tool: AiToolProfile,
  projectRoot: string
): Promise<void> {
  await planProjectMcpRemoval(fs, plugin, tool, projectRoot);
}

async function planProjectMcpRemoval(
  fs: FileReader,
  plugin: InstalledPlugin,
  tool: AiToolProfile,
  projectRoot: string
): Promise<{ output: string; content: string } | undefined> {
  if (plugin.mcpEntries.size === 0) return undefined;
  const mcp = tool.flatPluginMcp();
  if (mcp === null) return undefined;
  const output = join(
    projectRoot,
    await mcp.resolveOutputPath((relativePath) => fs.fileExists(join(projectRoot, relativePath)))
  );
  await assertProjectPathWithinRoot(fs, projectRoot, output);
  try {
    const existing = await fs.readFile(output);
    return { output, content: mcp.removePluginServers(existing, plugin.mcpEntries) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export class ProjectPluginCleanup {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly userManifestRepo?: ManifestRepository & Lock
  ) {}

  async assertLocalIntegrationRemovable(
    tool: AiToolProfile,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    await assertProjectMcpEntriesRemovable(this.fs, plugin, tool, projectRoot);
    await assertProjectHooksRemovable(this.fs, plugin, tool, projectRoot);
  }

  async removeLocalIntegration(
    tool: AiToolProfile,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    const mcpUpdate = await planProjectMcpRemoval(this.fs, plugin, tool, projectRoot);
    await removeProjectHooks(this.fs, plugin, tool, projectRoot);
    if (mcpUpdate !== undefined) {
      await assertProjectPathWithinRoot(this.fs, projectRoot, mcpUpdate.output);
      await this.fs.writeFile(mcpUpdate.output, mcpUpdate.content);
    }
  }

  async deleteLocalFiles(
    tool: AiToolProfile,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    await deletePluginFilesForTool(plugin.files, plugin.scope, tool, projectRoot, this.fs);
  }

  async detachClaims(
    projectRoot: string,
    nativeRefs: ReadonlyMap<ToolId, readonly string[]>,
    plugins: readonly RemovedPlugin[]
  ): Promise<void> {
    await detachNativePluginRefs(this.userManifestRepo, this.fs, projectRoot, nativeRefs);
    for (const { toolId, plugin } of plugins) {
      if (plugin.scope === "user") {
        await detachUserPlugin(this.userManifestRepo, this.fs, toolId, plugin.name, projectRoot);
      }
    }
  }
}
