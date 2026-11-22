import { join } from "node:path";
import { isErrnoException } from "../../../../shared/domain/reading/json-file.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { RemovedPlugin } from "../../contract/plugin-claims.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ProjectIntegrationCleanup } from "../../ports/project-integration-cleanup.js";
import type { FlatMcpSection, ProjectPluginIntegration } from "../../ports/tool-sections.js";
import { assertProjectPathWithinRoot } from "../ownership/project-path-boundary.js";
import { deletePluginFilesForTool } from "../plugin/delete-plugin-files.js";
import { assertProjectHooksRemovable, removeProjectHooks } from "../shared/remove-project-hooks.js";

/** Read-only OpenCode MCP proof, shared by Clean and local plugin removals before any detach. */
export async function assertProjectMcpEntriesRemovable(
  fs: FileReader,
  removal: ProjectMcpRemoval
): Promise<void> {
  await planProjectMcpRemoval(fs, removal);
}

/** The plugin whose MCP servers leave the project config of one tool. */
export interface ProjectMcpRemoval {
  readonly plugin: InstalledPlugin;
  readonly tool: FlatMcpSection;
  readonly projectRoot: string;
}

async function planProjectMcpRemoval(
  fs: FileReader,
  removal: ProjectMcpRemoval
): Promise<{ output: string; content: string } | undefined> {
  const { plugin, tool, projectRoot } = removal;
  if (plugin.provenance.mcpEntries.size === 0) return undefined;
  const mcp = tool.flatPluginMcp();
  if (mcp === null) return undefined;
  const output = join(
    projectRoot,
    await mcp.resolveOutputPath((relativePath) => fs.fileExists(join(projectRoot, relativePath)))
  );
  await assertProjectPathWithinRoot(fs, projectRoot, output);
  try {
    const existing = await fs.readFile(output);
    return { output, content: mcp.removePluginServers(existing, plugin.provenance.mcpEntries) };
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") return undefined;
    throw error;
  }
}

/** The machine claims a removal lets go of, supplied by the composition root. */
export interface RemovalClaims {
  readonly detachNativeRefs: (
    projectRoot: string,
    refsByTool: ReadonlyMap<ToolId, readonly string[]>
  ) => Promise<void>;
  readonly detachUserPlugin: (toolId: AiToolId, name: string, projectRoot: string) => Promise<void>;
}

export class RemoveProjectPlugin implements ProjectIntegrationCleanup {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly homedir: () => string,
    private readonly claims?: RemovalClaims
  ) {}

  async assertLocalIntegrationRemovable(
    tool: ProjectPluginIntegration,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    await assertProjectMcpEntriesRemovable(this.fs, { plugin, tool, projectRoot });
    await assertProjectHooksRemovable({ fs: this.fs, plugin, tool, projectRoot });
  }

  async removeLocalIntegration(
    tool: ProjectPluginIntegration,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    const mcpUpdate = await planProjectMcpRemoval(this.fs, { plugin, tool, projectRoot });
    await removeProjectHooks({ fs: this.fs, plugin, tool, projectRoot });
    if (mcpUpdate !== undefined) {
      await assertProjectPathWithinRoot(this.fs, projectRoot, mcpUpdate.output);
      await this.fs.writeFile(mcpUpdate.output, mcpUpdate.content);
    }
  }

  async deleteLocalFiles(
    tool: ProjectPluginIntegration,
    plugin: InstalledPlugin,
    projectRoot: string
  ): Promise<void> {
    await deletePluginFilesForTool(
      { files: plugin.files, scope: plugin.scope, tool, projectRoot, homedir: this.homedir },
      this.fs
    );
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
