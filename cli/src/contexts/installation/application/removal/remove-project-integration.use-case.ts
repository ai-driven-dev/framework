import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { LocalIntegrationRemoval } from "../../ports/project-integration-cleanup.js";
import type { AssertProjectPathWithinRoot } from "../ownership/assert-project-path-within-root.use-case.js";
import type { PlanProjectMcpRemoval } from "./plan-project-mcp-removal.use-case.js";
import type { RemoveEnabledPlugin } from "./project/remove-enabled-plugin.use-case.js";
import type { RemoveProjectHooks } from "./remove-project-hooks.use-case.js";

/** What RemoveProjectIntegration is built from. */
export interface RemoveProjectIntegrationDeps {
  readonly fs: FileWriter;
  readonly plan: Pick<PlanProjectMcpRemoval, "execute">;
  readonly hooks: Pick<RemoveProjectHooks, "execute">;
  readonly withinRoot: Pick<AssertProjectPathWithinRoot, "execute">;
  readonly enablement: Pick<RemoveEnabledPlugin, "execute">;
}

/** Takes a plugin's MCP servers, hooks and enabled entry out of the project files of one tool. */
export class RemoveProjectIntegration {
  constructor(private readonly deps: RemoveProjectIntegrationDeps) {}

  async execute(removal: LocalIntegrationRemoval): Promise<void> {
    const { fs, plan, hooks, withinRoot, enablement } = this.deps;
    const rewrite = await plan.execute(removal);
    await hooks.execute(removal);
    await enablement.execute(removal);
    if (rewrite === undefined) return;
    await withinRoot.execute(removal.projectRoot, rewrite.output);
    await fs.writeFile(rewrite.output, rewrite.content);
  }
}
