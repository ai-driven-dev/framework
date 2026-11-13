import { join } from "node:path";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { AiToolId, ToolId } from "../../../../kernel/tool.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";
import { assertProjectHooksRemovable, removeProjectHooks } from "../shared/remove-project-hooks.js";
import { detachNativePluginRefs } from "./native-plugin-ownership.js";
import { assertProjectPathWithinRoot } from "./project-path-boundary.js";
import { detachUserPlugin } from "./user-plugin-ownership.js";

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
    private readonly userManifestRepo?: ManifestRepository
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
