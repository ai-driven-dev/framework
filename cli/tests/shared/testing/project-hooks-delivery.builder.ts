import { createPluginTranslation } from "../../../src/composition/translate.js";
import type {
  ProjectHooksMaterializer,
  ProjectHooksMaterializerRequest,
  ProjectHooksMaterializerResult,
} from "../../../src/contexts/installation/application/materialize/project-hooks-materializer.use-case.js";
import type { AiToolProfile } from "../../../src/contexts/tools/contract/tool-profile.js";
import { registeredTools } from "./registered-tools.builder.js";

/** Delivers a plugin's hooks as the app does: what the engine made of them for the tool, handed
 * to the materializer that only places it. */
export function deliverProjectHooks(
  materializer: ProjectHooksMaterializer,
  request: Omit<ProjectHooksMaterializerRequest, "hooks"> & { readonly tool: AiToolProfile }
): Promise<ProjectHooksMaterializerResult> {
  const { projectHooks } = createPluginTranslation(registeredTools()).execute({
    distribution: request.dist,
    tool: request.tool,
  });
  return materializer.execute({ ...request, hooks: projectHooks });
}
