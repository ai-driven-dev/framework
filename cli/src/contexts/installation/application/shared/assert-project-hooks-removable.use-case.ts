import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { ProjectHooksSection } from "../../ports/tool-sections.js";
import type {
  AssertProjectHooksUnchanged,
  ProjectHooksGuard,
} from "./assert-project-hooks-unchanged.use-case.js";

/** The recorded plugin whose project hooks one tool is asked to give up. */
export interface PluginProjectHooks {
  readonly plugin: RecordedPlugin;
  readonly tool: ProjectHooksSection;
  readonly projectRoot: string;
  readonly guard?: ProjectHooksGuard;
}

/** Refuses while the hooks a plugin recorded for a tool are no longer the ones AIDD wrote. */
export class AssertProjectHooksRemovable {
  constructor(private readonly unchanged: Pick<AssertProjectHooksUnchanged, "execute">) {}

  async execute(request: PluginProjectHooks): Promise<void> {
    const { plugin, ...rest } = request;
    await this.unchanged.execute({
      ...rest,
      pluginName: plugin.plugin.name,
      provenance: plugin.provenance.projectHooks,
    });
  }
}
