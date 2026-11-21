import { basename, join, relative } from "node:path";
import { PLUGIN_AGENT_INPUT_EXT } from "../../domain/canon-format.js";
import { assertNoToolsPlaceholder } from "../../domain/tools-placeholder.js";
import type { DiskSinkDeps, PluginSource } from "../../ports/disk-sink-deps.js";
import type { SupportedArtifact } from "../../ports/flat-plugin-writer.js";
import type { DiskTarget } from "../../ports/plugin-tree-sink.js";
import { writeSkillTree } from "./write-skill-tree.js";

type ContentDeps = Pick<DiskSinkDeps, "fs" | "flat">;

/** One plugin's agents, in the marketplace layout or the flat one. Returns the files written. */
export async function writePluginAgents(
  deps: ContentDeps,
  t: DiskTarget,
  plugin: PluginSource
): Promise<number> {
  const artifact = t.contract.artifacts.agents;
  if (!artifact.supported) return 0;
  const agentsSrc = join(plugin.src, "agents");
  let count = 0;
  for (const absPath of await deps.fs.listFilesRecursive(agentsSrc)) {
    if (!absPath.endsWith(PLUGIN_AGENT_INPUT_EXT)) continue;
    count +=
      t.mode === "flat"
        ? await deps.flat.writeAgent({
            target: t,
            artifact,
            pluginName: plugin.name,
            absPath,
            srcRoot: agentsSrc,
          })
        : await writeMarketplaceAgent(deps, {
            t,
            artifact,
            pluginName: plugin.name,
            absPath,
            agentsSrc,
          });
  }
  return count;
}

async function writeMarketplaceAgent(
  deps: ContentDeps,
  {
    t,
    artifact,
    pluginName,
    absPath,
    agentsSrc,
  }: {
    t: DiskTarget;
    artifact: SupportedArtifact;
    pluginName: string;
    absPath: string;
    agentsSrc: string;
  }
): Promise<number> {
  const content = await deps.fs.readFile(absPath);
  const agentBaseName = basename(absPath);
  assertNoToolsPlaceholder(content, pluginName, relative(agentsSrc, absPath));
  const destRelPath = artifact.path(pluginName, `agents/${agentBaseName}`);
  const outContent = artifact.transform
    ? artifact.transform(content, pluginName, agentBaseName)
    : content;
  await deps.fs.writeFile(join(t.outDir, "plugins", pluginName, destRelPath), outContent);
  return 1;
}

/** One plugin's skills, in the marketplace layout or the flat one. Returns the files written. */
export async function writePluginSkills(
  deps: ContentDeps,
  t: DiskTarget,
  plugin: PluginSource
): Promise<number> {
  const artifact = t.contract.artifacts.skills;
  if (!artifact.supported) return 0;
  if (t.mode === "marketplace") {
    return writeSkillTree({
      fs: deps.fs,
      pluginName: plugin.name,
      pluginSrc: plugin.src,
      pluginOut: join(t.outDir, "plugins", plugin.name),
      transform: artifact.transform,
    });
  }
  const skillsSrc = join(plugin.src, "skills");
  let count = 0;
  for (const absPath of await deps.fs.listFilesRecursive(skillsSrc)) {
    count += await deps.flat.writeSkill({
      target: t,
      artifact,
      pluginName: plugin.name,
      absPath,
      srcRoot: skillsSrc,
    });
  }
  return count;
}
