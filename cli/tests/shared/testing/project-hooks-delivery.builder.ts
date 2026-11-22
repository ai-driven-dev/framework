import { createPluginTranslation } from "../../../src/composition/translate.js";
import type {
  ProjectHooksMaterializer,
  ProjectHooksMaterializerRequest,
  ProjectHooksMaterializerResult,
} from "../../../src/contexts/installation/application/materialize/project-hooks-materializer.use-case.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import type { AiToolProfile } from "../../../src/contexts/tools/contract/tool-profile.js";

/** Delivers a plugin's hooks as the app does: what the engine made of them for the tool, handed
 * to the materializer that only places it. */
export function deliverProjectHooks(
  materializer: ProjectHooksMaterializer,
  request: Omit<ProjectHooksMaterializerRequest, "hooks"> & {
    readonly tool: AiToolProfile;
    readonly tools: ToolCatalog;
  }
): Promise<ProjectHooksMaterializerResult> {
  const { projectHooks } = createPluginTranslation(request.tools).execute({
    distribution: request.dist,
    tool: request.tool,
  });
  return materializer.execute({ ...request, hooks: projectHooks });
}
