import { join } from "node:path";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { AiToolId, ToolId } from "../../../../kernel/tool.js";
import type { McpCapability } from "../../../tools/domain/capabilities/mcp-capability.js";
import { unmergeOpencodeMcp } from "../../../tools/domain/formats/opencode-mcp-merge.js";
import { getToolConfig, isAiTool } from "../../../tools/domain/registry.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import { deletePluginFilesForTool } from "../plugin/plugin-helpers.js";
import { isFrameworkPrimeFlatMcp } from "../plugin/plugin-target-resolution.js";
import { assertProjectHooksRemovable, removeProjectHooks } from "../shared/remove-project-hooks.js";
import { detachNativePluginRefs } from "./native-plugin-ownership.js";
import { assertProjectPathWithinRoot } from "./project-path-boundary.js";
import { detachUserPlugin } from "./user-plugin-ownership.js";

/** Read-only OpenCode MCP proof, shared by Clean and local plugin removals before any detach. */
export async function assertProjectMcpEntriesRemovable(
  fs: FileReader,
  plugin: InstalledPlugin,
  toolId: AiToolId,
  projectRoot: string
): Promise<void> {
  await planProjectMcpRemoval(fs, plugin, toolId, projectRoot);
}

async function planProjectMcpRemoval(
  fs: FileReader,
  plugin: InstalledPlugin,
  toolId: AiToolId,
  projectRoot: string
): Promise<{ output: string; content: string } | undefined> {
  if (plugin.mcpEntries.size === 0) return undefined;
  const config = getToolConfig(toolId);
  if (!isAiTool(config)) return undefined;
  const caps = config.capabilities as Record<string, unknown>;
  if (!isFrameworkPrimeFlatMcp(caps)) return undefined;
  const mcp = caps.mcp as McpCapability;
  const output = join(projectRoot, await mcp.resolveOutput(projectRoot, fs));
  await assertProjectPathWithinRoot(fs, projectRoot, output);
  try {
    const existing = await fs.readFile(output);
    return { output, content: unmergeOpencodeMcp(existing, plugin.mcpEntries) };
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
    toolId: AiToolId,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    await assertProjectMcpEntriesRemovable(this.fs, plugin, toolId, projectRoot);
    await assertProjectHooksRemovable(this.fs, plugin, toolId, projectRoot);
  }

  async removeLocalIntegration(
    toolId: AiToolId,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    const mcpUpdate = await planProjectMcpRemoval(this.fs, plugin, toolId, projectRoot);
    await removeProjectHooks(this.fs, plugin, toolId, projectRoot);
    if (mcpUpdate !== undefined) {
      await assertProjectPathWithinRoot(this.fs, projectRoot, mcpUpdate.output);
      await this.fs.writeFile(mcpUpdate.output, mcpUpdate.content);
    }
  }

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
