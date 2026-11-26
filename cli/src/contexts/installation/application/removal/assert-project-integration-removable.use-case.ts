import { join } from "node:path";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { ProjectPluginIntegration } from "../../ports/tool-sections.js";
import type { AssertProjectMcpEntriesRemovable } from "../assert-project-mcp-entries-removable.use-case.js";
import type { AssertProjectPathWithinRoot } from "../ownership/assert-project-path-within-root.use-case.js";
import type { AssertProjectHooksRemovable } from "../shared/assert-project-hooks-removable.use-case.js";

/** The recorded plugin whose project-local integration of one tool a removal lets go of. */
export interface ProjectIntegrationRemoval {
  readonly plugin: RecordedPlugin;
  readonly tool: ProjectPluginIntegration;
  readonly projectRoot: string;
}

/** Refuses while the MCP entries or hooks a plugin left in the project are no longer AIDD's, or
 * the file listing its rules is not the project's own. */
export class AssertProjectIntegrationRemovable {
  constructor(
    private readonly mcp: Pick<AssertProjectMcpEntriesRemovable, "execute">,
    private readonly hooks: Pick<AssertProjectHooksRemovable, "execute">,
    private readonly withinRoot: Pick<AssertProjectPathWithinRoot, "execute">
  ) {}

  async execute(removal: ProjectIntegrationRemoval): Promise<void> {
    await this.mcp.execute(removal);
    await this.hooks.execute(removal);
    const index = removal.tool.rulesIndex();
    if (index === null) return;
    await this.withinRoot.execute(
      removal.projectRoot,
      join(removal.projectRoot, index.relativePath)
    );
  }
}
