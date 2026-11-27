import type { LocalIntegrationRemoval } from "../../ports/project-integration-cleanup.js";
import type { PlanProjectMcpRemoval } from "./plan-project-mcp-removal.use-case.js";
import type { RemoveEnabledPlugin } from "./project/remove-enabled-plugin.use-case.js";
import type { UnlistProjectRules } from "./project/unlist-project-rules.use-case.js";
import type { WriteProjectMcpRewrite } from "./project/write-project-mcp-rewrite.use-case.js";
import type { RemoveProjectHooks } from "./remove-project-hooks.use-case.js";

/** What RemoveProjectIntegration is built from. */
export interface RemoveProjectIntegrationDeps {
  readonly plan: Pick<PlanProjectMcpRemoval, "execute">;
  readonly hooks: Pick<RemoveProjectHooks, "execute">;
  readonly rules: Pick<UnlistProjectRules, "execute">;
  readonly write: Pick<WriteProjectMcpRewrite, "execute">;
  readonly enablement: Pick<RemoveEnabledPlugin, "execute">;
}

/** Takes a plugin's MCP servers, hooks, listed rules and enabled entry out of the project files of one tool. */
export class RemoveProjectIntegration {
  constructor(private readonly deps: RemoveProjectIntegrationDeps) {}

  async execute(removal: LocalIntegrationRemoval): Promise<void> {
    const { plan, hooks, rules, write, enablement } = this.deps;
    const rewrite = await plan.execute(removal);
    await hooks.execute(removal);
    await rules.execute(removal);
    await enablement.execute(removal);
    if (rewrite === undefined) return;
    await write.execute(rewrite, removal.projectRoot);
  }
}
