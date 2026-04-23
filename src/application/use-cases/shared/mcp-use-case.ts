import type { Prompter } from "../../../domain/ports/prompter.js";
import { InputRequiredError } from "../../errors.js";

export interface McpOptions {
  keys: string[];
  defaultChecked: boolean;
  message: string;
  mcpFilter?: string[];
  interactive: boolean;
}

export class McpUseCase {
  constructor(private readonly prompter?: Prompter) {}

  async execute({
    keys,
    defaultChecked,
    message,
    mcpFilter,
    interactive,
  }: McpOptions): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    if (mcpFilter !== undefined && mcpFilter.length > 0)
      return this.validateFilter(mcpFilter, keys);
    if (interactive && this.prompter !== undefined)
      return this.prompt(keys, defaultChecked, message);
    return defaultChecked ? new Set(keys) : new Set();
  }

  private validateFilter(mcpFilter: string[], keys: string[]): Set<string> {
    const allKeys = new Set(keys);
    const invalid = mcpFilter.filter((k) => !allKeys.has(k));
    if (invalid.length > 0) {
      throw new InputRequiredError(
        `Unknown MCP server(s): ${invalid.join(", ")}. Available: ${keys.join(", ")}`
      );
    }
    return new Set(mcpFilter);
  }

  private async prompt(
    keys: string[],
    defaultChecked: boolean,
    message: string
  ): Promise<Set<string>> {
    if (this.prompter === undefined) return new Set();
    const choices = keys.map((key) => ({ name: key, value: key, checked: defaultChecked }));
    const selected = await this.prompter.checkbox(message, choices);
    return new Set(selected);
  }
}
