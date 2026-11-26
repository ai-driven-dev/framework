import type { PluginProjectHooks } from "../shared/assert-project-hooks-removable.use-case.js";
import type { RemoveRecordedProjectHooks } from "../shared/remove-recorded-project-hooks.use-case.js";

/** Takes the hooks a recorded plugin contributed to a tool's project hooks file back out. */
export class RemoveProjectHooks {
  constructor(private readonly recorded: Pick<RemoveRecordedProjectHooks, "execute">) {}

  async execute(request: PluginProjectHooks): Promise<boolean> {
    const { plugin, ...rest } = request;
    return this.recorded.execute({
      ...rest,
      pluginName: plugin.plugin.name,
      provenance: plugin.provenance.projectHooks,
    });
  }
}
