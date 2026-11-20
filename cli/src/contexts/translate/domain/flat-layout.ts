import { basename } from "node:path";
import type {
  ArtifactContract,
  FlatHooksBridge,
  ToolBuildContract,
} from "../../tools/contract/build-contract.js";
import type { OutputFile } from "./output-file.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;

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
  return { relativePath: bridge.path(pluginName), content };
}

/** Where an agent lands, whatever folder under `agents/` holds it: the one path its writer, a
 * command naming it and a link to it all resolve to. */
export function flatAgentPath(
  artifact: SupportedArtifact,
  pluginName: string,
  agentFile: string
): string {
  return artifact.path(pluginName, `agents/${basename(agentFile)}`);
}

/** Where a path inside a plugin lands in the flat layout: agents, skills and hooks move, anything
 * else stays where it is. */
export function flatPathOfPluginSuffix(
  contract: ToolBuildContract,
  suffix: string,
  pluginName: string
): string {
  const art = contract.artifacts;
  if (suffix.startsWith("agents/") && art.agents.supported) {
    return flatAgentPath(art.agents, pluginName, suffix);
  }
  if (suffix.startsWith("skills/") && art.skills.supported) {
    return art.skills.path(pluginName, suffix);
  }
  if (suffix.startsWith("hooks/") && art.hooks.supported) {
    return art.hooks.path(pluginName, suffix);
  }
  return suffix;
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
