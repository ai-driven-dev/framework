import type { ProjectContext } from "../../../domain/models/project-context.js";
import {
  AI_TOOL_IDS,
  type AiToolId,
  IDE_TOOL_IDS,
  type IdeToolId,
} from "../../../domain/models/tool-ids.js";
import type { Prompter } from "../../../domain/ports/prompter.js";

export interface SetupToolsPromptOptions {
  interactive: boolean;
  aiTools: readonly AiToolId[];
  ideTools: readonly IdeToolId[];
  context?: ProjectContext;
}

export interface SetupToolsPromptResult {
  aiTools: readonly AiToolId[];
  ideTools: readonly IdeToolId[];
}

export class SetupToolsPromptUseCase {
  constructor(private readonly prompter: Prompter) {}

  async execute(options: SetupToolsPromptOptions): Promise<SetupToolsPromptResult> {
    if (!options.interactive || options.aiTools.length > 0 || options.ideTools.length > 0) {
      return { aiTools: options.aiTools, ideTools: options.ideTools };
    }
    return this.promptTools(options.context);
  }

  private async promptTools(context?: ProjectContext): Promise<SetupToolsPromptResult> {
    const aiRecs = recommendAiTools(context);
    const ideRecs = recommendIdeTools(context);
    const aiTools = await this.prompter.checkbox<AiToolId>("Select AI tools to install:", [
      ...AI_TOOL_IDS.map((id) => ({
        name: aiRecs.includes(id) ? `${id} (recommended)` : id,
        value: id,
        checked: aiRecs.includes(id),
      })),
    ]);
    const ideTools = await this.prompter.checkbox<IdeToolId>("Select IDE tools to install:", [
      ...IDE_TOOL_IDS.map((id) => ({
        name: ideRecs.includes(id) ? `${id} (recommended)` : id,
        value: id,
        checked: ideRecs.includes(id),
      })),
    ]);
    return { aiTools, ideTools };
  }
}

export function recommendAiTools(context?: ProjectContext): readonly AiToolId[] {
  if (context === undefined) return ["claude"];
  if (context.hasFramework) return [];
  if (context.isMonorepo) return ["claude", "copilot"];
  if (context.stack === "typescript") return ["claude", "copilot"];
  if (context.stack === "python") return ["claude", "codex"];
  return ["claude"];
}

export function recommendIdeTools(context?: ProjectContext): readonly IdeToolId[] {
  if (context === undefined) return [];
  if (context.hasFramework) return [];
  if (context.stack === "typescript" || context.isMonorepo) return ["vscode"];
  return [];
}
