import { join } from "node:path";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { FlatMcpSection } from "../../ports/tool-sections.js";
import type { AssertProjectPathWithinRoot } from "../ownership/assert-project-path-within-root.use-case.js";

/** The plugin whose MCP servers leave the project config of one tool. */
export interface ProjectMcpRemoval {
  readonly plugin: RecordedPlugin;
  readonly tool: FlatMcpSection;
  readonly projectRoot: string;
}

/** The config file a removal would rewrite, with its new content. */
export interface ProjectMcpRewrite {
  readonly output: string;
  readonly content: string;
}

/** What a plugin's MCP servers leaving the project config would write, proven inside the project.
 * Writes nothing; answers `undefined` when there is nothing to take out. */
export class PlanProjectMcpRemoval {
  constructor(
    private readonly fs: FileReader,
    private readonly withinRoot: Pick<AssertProjectPathWithinRoot, "execute">
  ) {}

  async execute(removal: ProjectMcpRemoval): Promise<ProjectMcpRewrite | undefined> {
    const { plugin, tool, projectRoot } = removal;
    if (plugin.provenance.mcpEntries.size === 0) return undefined;
    const mcp = tool.flatPluginMcp();
    if (mcp === null) return undefined;
    const output = join(
      projectRoot,
      await mcp.resolveOutputPath((relativePath) =>
        this.fs.fileExists(join(projectRoot, relativePath))
      )
    );
    await this.withinRoot.execute(projectRoot, output);
    const existing = await whenAbsent(() => this.fs.readFile(output), undefined);
    if (existing === undefined) return undefined;
    return { output, content: mcp.removePluginServers(existing, plugin.provenance.mcpEntries) };
  }
}
