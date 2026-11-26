import type { Command } from "commander";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";

export function declareAgentModelOptions(command: Command, catalog: ToolCatalog): Command {
  return command
    .option(
      "--provider <provider>",
      `Run each tool's main session and agents on this provider's model for their role (${catalog.agentProviders().join(", ")}), or none for the IDE's model`
    )
    .option(
      "--agents-only",
      "Update the agents' models without changing the main session's settings; without --provider, each tool keeps its saved provider"
    );
}

/** `--provider` and `--agents-only` name a tool that runs the agents, through `--ide`. */
export function requireAgentHosts(
  flag: string,
  request: { hosts: readonly string[]; runnable: readonly string[] }
): void {
  if (request.hosts.length === 0) {
    throw new Error(
      `${flag} needs --ide with a tool that runs the framework's agents: ${request.runnable.join(", ")}.`
    );
  }
}
