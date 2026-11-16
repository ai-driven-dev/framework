import { join } from "node:path";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { RemovedPlugin } from "../../contract/plugin-claims.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";
import { assertProjectHooksRemovable, removeProjectHooks } from "../shared/remove-project-hooks.js";

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

/** The machine claims a removal lets go of, supplied by the composition root. */
export interface RemovalClaims {
  detachNativeRefs(
    projectRoot: string,
    refsByTool: ReadonlyMap<ToolId, readonly string[]>
  ): Promise<void>;
  detachUserPlugin(toolId: AiToolId, name: string, projectRoot: string): Promise<void>;
}

export class RemoveProjectPlugin {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly claims?: RemovalClaims
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
    await this.claims?.detachNativeRefs(projectRoot, nativeRefs);
    for (const { toolId, plugin } of plugins) {
      if (plugin.scope === "user") {
        await this.claims?.detachUserPlugin(toolId, plugin.name, projectRoot);
      }
    }
  }
}
