import type { ProjectContext } from "../../../contexts/installation/contract/project-context.js";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";
import {
  recommendAiTools,
  recommendIdeTools,
} from "../../../contexts/tools/contract/tool-recommendations.js";
import type { AiToolId, IdeToolId } from "../../../shared/domain/tool.js";
import type { Prompter } from "../../../shared/ports/prompter.js";

export interface ChooseToolsCommand {
  interactive: boolean;
  aiTools: readonly AiToolId[];
  ideTools: readonly IdeToolId[];
  context?: ProjectContext;
}

export interface ChooseToolsResult {
  aiTools: readonly AiToolId[];
  ideTools: readonly IdeToolId[];
}

export class ChooseTools {
  constructor(
    private readonly prompter: Prompter,
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: ChooseToolsCommand): Promise<ChooseToolsResult> {
    if (!options.interactive || options.aiTools.length > 0 || options.ideTools.length > 0) {
      return { aiTools: options.aiTools, ideTools: options.ideTools };
    }
    return this.promptTools(options.context);
  }

  private async promptTools(context?: ProjectContext): Promise<ChooseToolsResult> {
    const aiRecs = recommendAiTools(context);
    const ideRecs = recommendIdeTools(context);
    const aiTools = await this.prompter.checkbox<AiToolId>("Select AI tools to install:", [
      ...this.tools.idsInCanonicalOrder("ai").map((id) => ({
        name: aiRecs.includes(id) ? `${id} (recommended)` : id,
        value: id,
        checked: aiRecs.includes(id),
      })),
    ]);
    const ideTools = await this.prompter.checkbox<IdeToolId>("Select IDE tools to install:", [
      ...this.tools.idsInCanonicalOrder("ide").map((id) => ({
        name: ideRecs.includes(id) ? `${id} (recommended)` : id,
        value: id,
        checked: ideRecs.includes(id),
      })),
    ]);
    return { aiTools, ideTools };
  }
}
