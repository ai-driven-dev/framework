import {
  AI_TOOL_IDS,
  IDE_TOOL_IDS,
  type AiToolId,
  type IdeToolId,
} from "../../../domain/models/tool-ids.js";
import type { Prompter } from "../../../domain/ports/prompter.js";

export interface SetupToolsPromptOptions {
  interactive: boolean;
  aiTools: readonly AiToolId[];
  ideTools: readonly IdeToolId[];
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
    return this.promptTools();
  }

  private async promptTools(): Promise<SetupToolsPromptResult> {
    const aiTools = await this.prompter.checkbox<AiToolId>("Select AI tools to install:", [
      ...AI_TOOL_IDS.map((id) => ({ name: id, value: id })),
    ]);
    const ideTools = await this.prompter.checkbox<IdeToolId>("Select IDE tools to install:", [
      ...IDE_TOOL_IDS.map((id) => ({ name: id, value: id })),
    ]);
    return { aiTools, ideTools };
  }
}
