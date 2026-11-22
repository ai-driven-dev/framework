import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { AssertProjectPathWithinRoot } from "../ownership/assert-project-path-within-root.use-case.js";
import type { ProjectIntegrationRemoval } from "./assert-project-integration-removable.use-case.js";
import type { PlanProjectMcpRemoval } from "./plan-project-mcp-removal.use-case.js";
import type { RemoveProjectHooks } from "./remove-project-hooks.use-case.js";

/** What RemoveProjectIntegration is built from. */
export interface RemoveProjectIntegrationDeps {
  readonly fs: FileWriter;
  readonly plan: Pick<PlanProjectMcpRemoval, "execute">;
  readonly hooks: Pick<RemoveProjectHooks, "execute">;
  readonly withinRoot: Pick<AssertProjectPathWithinRoot, "execute">;
}

/** Takes a plugin's MCP servers and hooks out of the project files of one tool. */
export class RemoveProjectIntegration {
  constructor(private readonly deps: RemoveProjectIntegrationDeps) {}

  async execute(removal: ProjectIntegrationRemoval): Promise<void> {
    const { fs, plan, hooks, withinRoot } = this.deps;
    const rewrite = await plan.execute(removal);
    await hooks.execute(removal);
    if (rewrite === undefined) return;
    await withinRoot.execute(removal.projectRoot, rewrite.output);
    await fs.writeFile(rewrite.output, rewrite.content);
  }
}
