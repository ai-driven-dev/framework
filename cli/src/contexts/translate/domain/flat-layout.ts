import { basename } from "node:path";
import {
  artifactPath,
  hooksBridgeFilePath,
} from "../../../shared/domain/materialization/artifact-path.js";
import type {
  FlatHooksBridge,
  SupportedArtifact,
  ToolBuildContract,
} from "../../../shared/domain/materialization/build-contract.js";
import { pluginRootFolders } from "../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import type { OutputFile } from "./output-file.js";

/**
 * The generated hooks bridge of a flat install, whether it is built to disk or translated for an
 * install. `sourceShipsItsOwn` is whether the plugin's own hooks already carry the file the
 * bridge would replace. Nothing when it does, or when no event in the hooks maps to the bridge.
 */
export function flatHooksBridgeFile({
  bridge,
  rawHooksJson,
  pluginName,
  sourceShipsItsOwn,
}: {
  bridge: FlatHooksBridge;
  rawHooksJson: string;
  pluginName: string;
  sourceShipsItsOwn: boolean;
}): OutputFile | null {
  if (sourceShipsItsOwn) return null;
  const content = bridge.generate(rawHooksJson, pluginName);
  if (content === null) return null;
  return { relativePath: hooksBridgeFilePath(bridge, pluginName), content };
}

/** Whether a plugin's own hooks already carry the file a bridge would replace, in any folder. */
export function sourceShipsHooksBridge(
  hooks: readonly { readonly relativePath: string }[],
  bridge: FlatHooksBridge
): boolean {
  return hooks.some((file) => basename(file.relativePath) === bridge.skipIfSourceHas);
}

/** Where an agent lands, whatever folder under `agents/` holds it: the one path its writer, a
 * command naming it and a link to it all resolve to. A nested agent lands by its file name; real
 * data has none. */
export function flatAgentPath(
  artifact: SupportedArtifact,
  pluginName: string,
  agentFile: string
): string {
  return artifactPath(artifact, pluginName, `agents/${basename(agentFile)}`);
}

/** Where the tool places a path inside a plugin: agents, skills and hooks move. Nothing for any
 * other folder, which the tool has no place for. */
function placedPluginSuffix(
  contract: ToolBuildContract,
  suffix: string,
  pluginName: string
): string | null {
  const art = contract.artifacts;
  if (suffix.startsWith("agents/") && art.agents.supported) {
    return flatAgentPath(art.agents, pluginName, suffix);
  }
  if (suffix.startsWith("skills/") && art.skills.supported) {
    return artifactPath(art.skills, pluginName, suffix);
  }
  if (suffix.startsWith("hooks/") && art.hooks.supported) {
    return artifactPath(art.hooks, pluginName, suffix);
  }
  return null;
}

/** Where a path inside a plugin lands in the flat layout: agents, skills and hooks move, anything
 * else stays where it is. */
export function flatPathOfPluginSuffix(
  contract: ToolBuildContract,
  suffix: string,
  pluginName: string
): string {
  return placedPluginSuffix(contract, suffix, pluginName) ?? suffix;
}

/** Whether a flat build folds a plugin's MCP servers into the tool's config, so the commands in
 * its MCP declaration are the ones the build must ship. A tool with an event bridge also ships
 * folders its bridge never replays: accepted, as the folders are small and shipping fewer would
 * need the bridge to say which it runs. */
export function flatFoldsMcp(contract: ToolBuildContract): boolean {
  const { mcp } = contract.artifacts;
  return (
    (mcp.supported && mcp.mcpServersKey !== undefined) || contract.configArtifact !== undefined
  );
}

/** Where a path a shipped command names lands: where the tool places it, else in a folder of the
 * plugin's own name, so two plugins never share one. */
function flatCommandPath(contract: ToolBuildContract, suffix: string, pluginName: string): string {
  const placed = placedPluginSuffix(contract, suffix, pluginName);
  return placed ?? (suffix.includes("/") ? `${pluginName}/${suffix}` : suffix);
}

/** The folders the commands in `content` name that the tool has no place for: the ones a build
 * copies to `<plugin>/<folder>/`. */
export function flatCommandFolders(
  contract: ToolBuildContract,
  content: string,
  pluginName: string
): string[] {
  return pluginRootFolders(content).filter(
    (folder) => placedPluginSuffix(contract, `${folder}/`, pluginName) === null
  );
}

type FlatHooksFile = NonNullable<
  Extract<ToolBuildContract["artifacts"]["hooks"], { supported: true }>["hooksFile"]
>;

/** A plugin's hooks manifest folded into a tool's hooks file, every path it names placed where the
 * flat layout puts it: the one merge a build writes, whether into a file of the plugin's own or
 * one every plugin shares. */
export function mergeFlatHooks(
  { file, contract }: { file: FlatHooksFile; contract: ToolBuildContract },
  existing: string | null,
  shipped: { json: string; plugin: string }
): { content: string; warnings: readonly string[] } {
  const { json, plugin } = shipped;
  return file.merge(existing, {
    json,
    plugin,
    locate: (pluginPath) => `./${flatCommandPath(contract, pluginPath, plugin)}`,
  });
}

/** Where a markdown link's target lands in the flat layout: only agents and skills move. */
export function flatLinkTarget(
  contract: ToolBuildContract,
  pluginName: string,
  pluginRelPath: string
): string {
  return pluginRelPath.startsWith("hooks/")
    ? pluginRelPath
    : flatPathOfPluginSuffix(contract, pluginRelPath, pluginName);
}

/** A plugin-root reference resolved into the output a flat build writes. "/"-joined and
 * separator-normalized: this value is embedded into written JSON content, and on Windows
 * `outDir` is backslash-native: JSON.stringify then escapes each backslash, so a reader
 * comparing against the plain outDir string never finds it as a substring. */
export function flatPluginRootAbsolute(
  target: { readonly contract: ToolBuildContract; readonly outDir: string },
  suffix: string,
  pluginName: string
): string {
  const normalizedOut = target.outDir.replace(/\\/g, "/");
  return `${normalizedOut}/${flatCommandPath(target.contract, suffix, pluginName)}`;
}
