import type {
  PlanProjectMcpRemoval,
  ProjectMcpRemoval,
} from "./removal/plan-project-mcp-removal.use-case.js";

/** Read-only OpenCode MCP proof, shared by Clean and local plugin removals before any detach. */
export class AssertProjectMcpEntriesRemovable {
  constructor(private readonly plan: Pick<PlanProjectMcpRemoval, "execute">) {}

  async execute(removal: ProjectMcpRemoval): Promise<void> {
    await this.plan.execute(removal);
  }
}
