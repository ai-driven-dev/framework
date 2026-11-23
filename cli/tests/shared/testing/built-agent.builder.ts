import type { FrameworkBuildMode } from "../../../src/contexts/tools/contract/tool-profile.js";
import type { ToolBuildContract } from "../../../src/shared/domain/materialization/build-contract.js";
import { PluginDistribution } from "../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../src/shared/domain/plugin/plugin-name.js";
import { translateBuildLayout } from "./build-files.builder.js";
import { SYNTHETIC_TOOL } from "./synthetic-tool-id.builder.js";

/** An agent as the engine builds it for the contract in the given mode: its file, its place
 * inside the plugin when the mode keeps one. */
export function builtAgentFile(
  contract: ToolBuildContract,
  mode: FrameworkBuildMode,
  source: string,
  plugin: string,
  outName: string
): { path: string; content: string } {
  const [file] = translateBuildLayout(canonOfAgent(plugin, outName, source), contract, mode);
  if (file === undefined) throw new Error(`the contract builds no agent for ${outName}`);
  const inPlugin = `plugins/${plugin}/`;
  const path = file.relativePath.startsWith(inPlugin)
    ? file.relativePath.slice(inPlugin.length)
    : file.relativePath;
  return { path, content: file.content };
}

/** The engine's content for an agent, in the shape the build tests read it. */
export function builtAgent(
  contract: ToolBuildContract,
  mode: FrameworkBuildMode
): (source: string, plugin: string, outName: string) => string {
  return (source, plugin, outName) =>
    builtAgentFile(contract, mode, source, plugin, outName).content;
}

function canonOfAgent(plugin: string, outName: string, content: string): PluginDistribution {
  const agent = { relativePath: `agents/${outName}`, content };
  return new PluginDistribution({
    manifest: { name: parsePluginName(plugin), version: "" },
    format: SYNTHETIC_TOOL,
    files: [agent],
    components: { commands: [], agents: [agent], skills: [], rules: [], hooks: [], mcp: [] },
  });
}
