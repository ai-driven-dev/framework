import type { Command } from "commander";
import type { ToolCatalog } from "../../../contexts/tools/contract/tool-catalog.js";

/** The options that choose the models the agents run on. */
export function declareAgentModelOptions(command: Command, catalog: ToolCatalog): Command {
  return command
    .option(
      "--provider <provider>",
      `Run each tool's main session and agents on this provider's model for their role (${catalog.agentProviders().join(", ")}), or none for the IDE's model`
    )
    .option(
      "--agents-only",
      "Update the agents' models without changing the main session's settings (requires --provider)"
    );
}

/** `--provider` names a tool that runs the agents, through `--ide`. */
export function requireAgentHosts(
  provider: string | undefined,
  request: { hosts: readonly string[]; runnable: readonly string[] }
): void {
  if (provider !== undefined && request.hosts.length === 0) {
    throw new Error(
      `--provider needs --ide with a tool that runs the framework's agents: ${request.runnable.join(", ")}.`
    );
  }
}

/** `--agents-only` changes the agents' models, so it names the provider they take, or none. */
export function requireProviderForAgentsOnly(
  agentsOnly: boolean | undefined,
  provider: string | undefined
): void {
  if (agentsOnly === true && provider === undefined) {
    throw new Error("--agents-only needs --provider, a provider or none.");
  }
}
