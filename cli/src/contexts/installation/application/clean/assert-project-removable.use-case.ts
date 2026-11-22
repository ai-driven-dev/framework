import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { AssertProjectHooksRemovable } from "../shared/assert-project-hooks-removable.use-case.js";
import type { ProjectCleanAsks } from "./clean-project-files.use-case.js";

/** What AssertProjectRemovable is built from. */
export interface AssertProjectRemovableDeps {
  readonly assertHooksRemovable: Pick<AssertProjectHooksRemovable, "execute">;
  readonly manifestRepo: ManifestRepository;
  readonly assertMcpRemovable: ProjectCleanAsks["assertMcpRemovable"];
}

/** Refuses while a hook or an MCP entry of a tracked plugin could not be removed cleanly. */
export class AssertProjectRemovable {
  constructor(
    private readonly deps: AssertProjectRemovableDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(command: { projectRoot: string; force: boolean }): Promise<void> {
    const manifest = await this.deps.manifestRepo.load();
    if (manifest === null) return;
    for (const toolId of manifest.getInstalledToolIds()) {
      if (!this.tools.isAiTool(toolId)) continue;
      for (const plugin of manifest.getRecordedPlugins(toolId)) {
        const tool = this.tools.aiProfile(toolId);
        await this.deps.assertHooksRemovable.execute({
          plugin,
          tool,
          projectRoot: command.projectRoot,
          guard: { overwriteEdited: command.force },
        });
        await this.deps.assertMcpRemovable(plugin, tool, command.projectRoot);
      }
    }
  }
}
