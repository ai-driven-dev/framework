import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { AssertProjectPathWithinRoot } from "../../ownership/assert-project-path-within-root.use-case.js";
import type { ProjectMcpRewrite } from "../plan-project-mcp-removal.use-case.js";

/** Writes a planned MCP config rewrite, proving its file still sits inside the project. */
export class WriteProjectMcpRewrite {
  constructor(
    private readonly fs: FileWriter,
    private readonly withinRoot: Pick<AssertProjectPathWithinRoot, "execute">
  ) {}

  async execute(rewrite: ProjectMcpRewrite, projectRoot: string): Promise<void> {
    await this.withinRoot.execute(projectRoot, rewrite.output);
    await this.fs.writeFile(rewrite.output, rewrite.content);
  }
}
