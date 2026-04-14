import type { Prompter } from "../../../domain/ports/prompter.js";
import { InputRequiredError } from "../../errors.js";

export interface McpOptions {
  available: Map<string, string[]>;
  mcpFilter: string[];
  interactive: boolean;
}

/**
 * Resolves which MCP servers the user wants to install.
 * 3-branch: explicit filter → validate; interactive → prompt; default → all.
 */
export class McpUseCase {
  constructor(private readonly prompter?: Prompter) {}

  async execute({ available, mcpFilter, interactive }: McpOptions): Promise<Set<string>> {
    const allKeys = this.collectAllKeys(available);
    if (allKeys.size === 0) return allKeys;
    if (mcpFilter.length > 0) return this.validateFilter(mcpFilter, allKeys);
    if (interactive && this.prompter !== undefined) return this.prompt(allKeys);
    return new Set();
  }

  private collectAllKeys(available: Map<string, string[]>): Set<string> {
    const keys = new Set<string>();
    for (const values of available.values()) for (const k of values) keys.add(k);
    return keys;
  }

  private validateFilter(mcpFilter: string[], allKeys: Set<string>): Set<string> {
    const invalid = mcpFilter.filter((k) => !allKeys.has(k));
    if (invalid.length > 0) {
      throw new InputRequiredError(
        `Unknown MCP server(s): ${invalid.join(", ")}. Available: ${[...allKeys].join(", ")}`
      );
    }
    return new Set(mcpFilter);
  }

  private async prompt(allKeys: Set<string>): Promise<Set<string>> {
    if (!this.prompter) return new Set();
    const choices = [...allKeys].map((key) => ({ name: key, value: key, checked: false }));
    const selected = await this.prompter.checkbox(
      "Which MCP servers do you want to install?",
      choices
    );
    return new Set(selected);
  }
}
